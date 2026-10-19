import mongoose from "mongoose";
import { Account, CURRENCIES, type Currency } from "../../models/account.model.js";
import { Movement } from "../../models/movement.model.js";
import type { ClientSession } from "mongoose";
import { convertCents } from "./exchange-rates.js";
import { getRates, type RateSource } from "./rates.service.js";

// Construyo una cuenta pública eligiendo los campos a mano.
function toPublicAccount(account: PublicAccount): PublicAccount {
    return {
        id: account.id,
        currency: account.currency,
        balanceCents: account.balanceCents,
        updatedAt: account.updatedAt,
    };
}

// Defino los únicos datos de una cuenta que puedo devolver al exterior.
export type PublicAccount = {
    id: string;
    currency: string;
    balanceCents: number;
    updatedAt: Date;
};

// Error propio para "esa cuenta no existe o no es del usuario".
export class AccountNotFoundError extends Error {
    constructor() {
        super("Cuenta no encontrada.");
        this.name = "AccountNotFoundError";
    }
}

// Defino los únicos datos de un movimiento que puedo devolver al exterior.
export type PublicMovement = {
    id: string;
    currency: string;
    type: string;
    amountCents: number;
    balanceAfterCents: number;
    createdAt: Date;
    exchangeId: string | null;
};

// El documento trae el id del cambio como ObjectId opcional; el público lo expone como texto o null.
type MovementSource = Omit<PublicMovement, "exchangeId"> & {
    exchangeId?: { toString(): string } | null | undefined;
};

function toPublicMovement(movement: MovementSource): PublicMovement {
    return {
        id: movement.id,
        currency: movement.currency,
        type: movement.type,
        amountCents: movement.amountCents,
        balanceAfterCents: movement.balanceAfterCents,
        createdAt: movement.createdAt,
        exchangeId: movement.exchangeId ? movement.exchangeId.toString() : null,
    };
}

// Defino lo que devuelve un ingreso: la cuenta ya actualizada y el apunte creado.
export type DepositResult = {
    account: PublicAccount;
    movement: PublicMovement;
};

// Me aseguro de que el usuario tenga una cuenta por cada moneda admitida.
// Si recibo una sesión, mis escrituras forman parte de esa transacción.
export async function ensureAccounts(
    userId: string,
    session?: ClientSession,
): Promise<void> {
    await Account.bulkWrite(
        CURRENCIES.map((currency) => ({
            updateOne: {
                filter: { user: userId, currency },
                update: { $setOnInsert: { balanceCents: 0 } },
                upsert: true,
            },
        })),
        session ? { session } : {},
    );
}

// Devuelvo las cuentas de un usuario, creando las que falten.
export async function listAccounts(userId: string): Promise<PublicAccount[]> {
    await ensureAccounts(userId);

    // Filtro siempre por usuario: así nadie puede ver cuentas ajenas.
    const accounts = await Account.find({ user: userId }).sort({ currency: 1 });

    return accounts.map((account) => ({
        id: account.id,
        currency: account.currency,
        balanceCents: account.balanceCents,
        updatedAt: account.updatedAt,
    }));
}

// Ingreso simulado: sumo el importe a la cuenta y dejo un apunte en el libro, todo o nada.
export async function depositToAccount(
    userId: string,
    currency: Currency,
    amountCents: number,
): Promise<DepositResult> {
    const session = await mongoose.startSession();

    // Guardo el resultado fuera de la transacción, porque la función puede ejecutarse más de una vez.
    let result = null as DepositResult | null;

    try {
        await session.withTransaction(async () => {
            // Sumo con $inc en una sola operación atómica, filtrando por dueño y moneda.
            const account = await Account.findOneAndUpdate(
                { user: userId, currency },
                { $inc: { balanceCents: amountCents } },
                { returnDocument: "after", session },
            );

            // Si no existe, lanzar el error cancela la transacción.
            if (!account) {
                throw new AccountNotFoundError();
            }

            // Anoto el movimiento con el saldo que quedó tras sumar.
            const [movement] = await Movement.create(
                [
                    {
                        user: userId,
                        account: account._id,
                        currency,
                        type: "deposit",
                        amountCents,
                        balanceAfterCents: account.balanceCents,
                    },
                ],
                { session },
            );

            result = {
                account: {
                    id: account.id,
                    currency: account.currency,
                    balanceCents: account.balanceCents,
                    updatedAt: account.updatedAt,
                },
                movement: toPublicMovement(movement),
            };
        });
    } finally {
        // Cierro siempre la sesión, haya ido bien o mal.
        await session.endSession();
    }

    if (!result) {
        throw new Error("La transacción terminó sin resultado.");
    }

    return result;
}

// Defino una página de movimientos y el cursor para pedir la siguiente.
export type MovementsPage = {
    movements: PublicMovement[];
    nextBefore: string | null;
};

// Devuelvo los movimientos del usuario, del más reciente al más antiguo.
export async function listMovements(
    userId: string,
    options: { limit: number; before?: string | undefined; currency?: Currency | undefined },
): Promise<MovementsPage> {
    // Filtro siempre por usuario. El cursor solo puede acotar dentro de sus propios movimientos.
    const rows = await Movement.find({
        user: userId,
        ...(options.currency ? { currency: options.currency } : {}),
        ...(options.before ? { _id: { $lt: options.before } } : {}),
    })
        .sort({ _id: -1 })
        // Pido uno más de los necesarios para saber si existe una página siguiente.
        .limit(options.limit + 1);

    const hasMore = rows.length > options.limit;
    const page = hasMore ? rows.slice(0, options.limit) : rows;

    return {
        movements: page.map(toPublicMovement),
        nextBefore: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    };
}

export class InsufficientFundsError extends Error {
    constructor() {
        super("Saldo insuficiente.");
        this.name = "InsufficientFundsError";
    }
}

export class AmountTooSmallError extends Error {
    constructor() {
        super("El importe es demasiado pequeño: al convertirlo se obtendría 0.");
        this.name = "AmountTooSmallError";
    }
}

export type ExchangeResult = {
    exchangeId: string;
    sold: DepositResult;
    bought: DepositResult;
    rate: { source: RateSource; asOf: Date };
};

// Cambio de moneda entre dos cuentas del usuario, todo o nada.
export async function exchangeCurrency(
    userId: string,
    from: Currency,
    to: Currency,
    amountCents: number,
): Promise<ExchangeResult> {
    // Pido las tasas antes de abrir la transacción: es una llamada de red.
    const quote = await getRates();
    const receivedCents = convertCents(amountCents, from, to, quote.unitsPerEur);

    // Rechazo los cambios que darían 0: el usuario perdería dinero sin recibir nada.
    if (receivedCents < 1) {
        throw new AmountTooSmallError();
    }

    const rateFields = {
        exchangeId: new mongoose.Types.ObjectId(),
        rateSource: quote.source,
        rateAsOf: quote.asOf,
        rateFromUnits: Number(quote.unitsPerEur[from]),
        rateToUnits: Number(quote.unitsPerEur[to]),
    };

    const session = await mongoose.startSession();
    let result = null as ExchangeResult | null;

    try {
        await session.withTransaction(async () => {
            // Descuento solo si el saldo alcanza: el filtro y la resta son una única operación atómica.
            const source = await Account.findOneAndUpdate(
                { user: userId, currency: from, balanceCents: { $gte: amountCents } },
                { $inc: { balanceCents: -amountCents } },
                { returnDocument: "after", session },
            );

            if (!source) {
                // Distingo "no hay saldo" de "no existe la cuenta" solo cuando ya falló.
                const exists = await Account.exists({ user: userId, currency: from }).session(session);
                throw exists ? new InsufficientFundsError() : new AccountNotFoundError();
            }

            const target = await Account.findOneAndUpdate(
                { user: userId, currency: to },
                { $inc: { balanceCents: receivedCents } },
                { returnDocument: "after", session },
            );

            // Si falta la cuenta de destino, lanzar el error deshace también el descuento.
            if (!target) {
                throw new AccountNotFoundError();
            }

            const [outMovement] = await Movement.create(
                [{
                    user: userId,
                    account: source._id,
                    currency: from,
                    type: "exchange_out",
                    amountCents,
                    balanceAfterCents: source.balanceCents,
                    ...rateFields,
                }],
                { session },
            );

            const [inMovement] = await Movement.create(
                [{
                    user: userId,
                    account: target._id,
                    currency: to,
                    type: "exchange_in",
                    amountCents: receivedCents,
                    balanceAfterCents: target.balanceCents,
                    ...rateFields,
                }],
                { session },
            );

            result = {
                exchangeId: rateFields.exchangeId.toString(),
                sold: { account: toPublicAccount(source), movement: toPublicMovement(outMovement) },
                bought: { account: toPublicAccount(target), movement: toPublicMovement(inMovement) },
                rate: { source: quote.source, asOf: quote.asOf },
            };
        });
    } finally {
        await session.endSession();
    }

    if (!result) {
        throw new Error("La transacción terminó sin resultado.");
    }

    return result;
}
