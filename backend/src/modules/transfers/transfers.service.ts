import mongoose from "mongoose";
import { Account, type Currency } from "../../models/account.model.js";
import { Contact } from "../../models/contact.model.js";
import { Movement } from "../../models/movement.model.js";
import { Transfer } from "../../models/transfer.model.js";
import { User } from "../../models/user.model.js";
import { isDuplicateKeyError } from "../../utils/mongo-errors.js";
import {
    AccountNotFoundError,
    InsufficientFundsError,
    ensureAccounts,
    toPublicAccount,
    toPublicMovement,
    type PublicAccount,
    type PublicCounterparty,
    type PublicMovement,
} from "../accounts/accounts.service.js";
import { ContactNotFoundError } from "../contacts/contacts.service.js";

export class CannotSendToSelfError extends Error {
    constructor() {
        super("No puedes enviarte dinero a ti mismo.");
        this.name = "CannotSendToSelfError";
    }
}

export class IdempotencyKeyReusedError extends Error {
    constructor() {
        super("Esa clave de idempotencia ya se usó con otros datos.");
        this.name = "IdempotencyKeyReusedError";
    }
}

export type TransferInput = {
    contactId: string;
    currency: Currency;
    amountCents: number;
    note: string;
    idempotencyKey: string;
};

export type TransferResult = {
    transferId: string;
    account: PublicAccount;
    movement: PublicMovement;
    recipient: PublicCounterparty;
    replayed: boolean;
};

// Si este envío ya se procesó, reconstruyo su resultado. Si la clave se usó con otros datos, la rechazo.
async function findReplay(
    senderId: string,
    recipientId: string,
    recipient: PublicCounterparty,
    input: TransferInput,
): Promise<TransferResult | null> {
    const existing = await Transfer.findOne({ sender: senderId, idempotencyKey: input.idempotencyKey });

    if (!existing) {
        return null;
    }

    const sameRequest =
        existing.recipient.toString() === recipientId &&
        existing.currency === input.currency &&
        existing.amountCents === input.amountCents &&
        existing.note === input.note;

    if (!sameRequest) {
        throw new IdempotencyKeyReusedError();
    }

    const movement = await Movement.findOne({ transferId: existing._id, user: senderId });
    const account = await Account.findOne({ user: senderId, currency: input.currency });

    if (!movement || !account) {
        throw new Error("La transferencia existe pero le faltan datos.");
    }

    return {
        transferId: existing.id,
        account: toPublicAccount(account),
        movement: toPublicMovement(movement, new Map([[recipientId, recipient]])),
        recipient,
        replayed: true,
    };
}

export async function sendTransfer(senderId: string, input: TransferInput): Promise<TransferResult> {
    // El destinatario sale de un contacto del remitente, nunca del cuerpo de la petición.
    const contact = await Contact.findOne({ _id: input.contactId, owner: senderId });

    if (!contact) {
        throw new ContactNotFoundError();
    }

    const recipientUser = await User.findById(contact.user).select("name avatarId");

    if (!recipientUser) {
        throw new ContactNotFoundError();
    }

    if (recipientUser.id === senderId) {
        throw new CannotSendToSelfError();
    }

    const recipientId = recipientUser.id;
    const recipient: PublicCounterparty = {
        name: recipientUser.name,
        avatarId: recipientUser.avatarId ?? null,
    };

    const replay = await findReplay(senderId, recipientId, recipient, input);

    if (replay) {
        return replay;
    }

    const session = await mongoose.startSession();
    let result = null as TransferResult | null;

    try {
        await session.withTransaction(async () => {
            // Primero el registro maestro: si la clave ya existe, falla antes de mover dinero.
            const [transfer] = await Transfer.create(
                [
                    {
                        sender: senderId,
                        recipient: recipientId,
                        currency: input.currency,
                        amountCents: input.amountCents,
                        note: input.note,
                        idempotencyKey: input.idempotencyKey,
                    },
                ],
                { session },
            );

            // Actualizo la fecha de última transferencia del contacto del remitente
            await Contact.updateOne(
                { _id: contact._id },
                { $set: { lastTransferredAt: transfer.createdAt ?? new Date() } },
                { session },
            );

            // Descuento solo si el saldo alcanza: filtro y resta son una única operación atómica.
            const source = await Account.findOneAndUpdate(
                { user: senderId, currency: input.currency, balanceCents: { $gte: input.amountCents } },
                { $inc: { balanceCents: -input.amountCents } },
                { returnDocument: "after", session },
            );

            if (!source) {
                const exists = await Account.exists({ user: senderId, currency: input.currency }).session(session);
                throw exists ? new InsufficientFundsError() : new AccountNotFoundError();
            }

            // El destinatario puede ser anterior a alguna moneda: me aseguro de que tenga la cuenta.
            await ensureAccounts(recipientId, session);

            const target = await Account.findOneAndUpdate(
                { user: recipientId, currency: input.currency },
                { $inc: { balanceCents: input.amountCents } },
                { returnDocument: "after", session },
            );

            if (!target) {
                throw new AccountNotFoundError();
            }

            const noteField = input.note ? { note: input.note } : {};

            const [outMovement] = await Movement.create(
                [
                    {
                        user: senderId,
                        account: source._id,
                        currency: input.currency,
                        type: "transfer_out",
                        amountCents: input.amountCents,
                        balanceAfterCents: source.balanceCents,
                        transferId: transfer._id,
                        counterparty: recipientId,
                        ...noteField,
                    },
                ],
                { session },
            );

            await Movement.create(
                [
                    {
                        user: recipientId,
                        account: target._id,
                        currency: input.currency,
                        type: "transfer_in",
                        amountCents: input.amountCents,
                        balanceAfterCents: target.balanceCents,
                        transferId: transfer._id,
                        counterparty: senderId,
                        ...noteField,
                    },
                ],
                { session },
            );

            result = {
                transferId: transfer.id,
                account: toPublicAccount(source),
                movement: toPublicMovement(outMovement, new Map([[recipientId, recipient]])),
                recipient,
                replayed: false,
            };
        });
    } catch (error) {
        // Dos peticiones simultáneas con la misma clave: la perdedora se convierte en repetición.
        if (isDuplicateKeyError(error)) {
            const again = await findReplay(senderId, recipientId, recipient, input);

            if (again) {
                return again;
            }
        }

        throw error;
    } finally {
        await session.endSession();
    }

    if (!result) {
        throw new Error("La transacción terminó sin resultado.");
    }

    return result;
}
