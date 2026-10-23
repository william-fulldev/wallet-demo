import mongoose, { type ClientSession } from "mongoose";
import { Account } from "../../models/account.model.js";
import { Contact } from "../../models/contact.model.js";
import { Movement } from "../../models/movement.model.js";
import { User } from "../../models/user.model.js";
import { isDuplicateKeyError } from "../../utils/mongo-errors.js";
import { depositToAccount, ensureAccounts } from "../accounts/accounts.service.js";
import { registerUser } from "../auth/auth.service.js";
import {
    DEMO_USERS,
    INITIAL_EUR_FINAL_CENTS,
    INITIAL_USD_CENTS,
    INITIAL_BRL_CENTS,
    demoPassword,
} from "./demo-users.js";


// 8 gastos en comercios de ejemplo (uno por comercio y un segundo en Starbucks)
export const DEMO_PAYMENTS = [
    { key: "netflix", amountCents: 1299 },
    { key: "uber", amountCents: 830 },
    { key: "amazon", amountCents: 2740 },
    { key: "zara", amountCents: 4995 },
    { key: "spotify", amountCents: 1099 },
    { key: "apple", amountCents: 299 },
    { key: "starbucks", amountCents: 485 },
    { key: "mcdonalds", amountCents: 950 },
] as const;

// Suma total calculada dinámicamente a partir del catálogo de gastos (hoy 12_232 céntimos).
export const TOTAL_DEMO_PAYMENTS_CENTS = DEMO_PAYMENTS.reduce((sum, p) => sum + p.amountCents, 0);

export type SeedUsersResult = {
    usersCreated: number;
    usersExisting: number;
};

export type EnsureContactsResult = {
    contactsCreated: number;
    contactsExisting: number;
};

export type SeedActivityResult = {
    executed: boolean;
    paymentsCreated: number;
};

export type LinkAllContactsResult = {
    totalContactsCreated: number;
    totalContactsExisting: number;
    totalActivitiesSeeded: number;
};

export async function seedDemoUsers(password?: string): Promise<SeedUsersResult> {
    let usersCreated = 0;
    let usersExisting = 0;

    for (const demo of DEMO_USERS) {
        const existing = await User.findOne({ email: demo.email });

        if (!existing) {
            // registerUser crea el usuario y sus cuentas asociadas (ensureAccounts).
            const created = await registerUser({
                name: demo.name,
                email: demo.email,
                password: password ?? demoPassword(demo),
            });

            // Asigno el avatar correspondiente.
            await User.updateOne({ _id: created.id }, { $set: { avatarId: demo.avatarId } });

            // La financiación inicial queda unificada en seedDemoActivity(userId)
            // para evitar duplicar ingresos y garantizar 500 EUR, 500 USD y 500 BRL.
            usersCreated++;
        } else {
            // Idempotente: si ya existe, no se toca el saldo pero se asegura el avatarId.
            await User.updateOne({ _id: existing._id }, { $set: { avatarId: demo.avatarId } });
            usersExisting++;
        }
    }

    return { usersCreated, usersExisting };
}

export async function ensureDemoContacts(userId: string): Promise<EnsureContactsResult> {
    let contactsCreated = 0;
    let contactsExisting = 0;

    // Obtengo los IDs de los usuarios demo en la base de datos.
    const demoEmails = DEMO_USERS.map((u) => u.email);
    const demoUsers = await User.find({ email: { $in: demoEmails } }).select("_id email");

    for (const demoUser of demoUsers) {
        // Un usuario nunca es contacto de sí mismo.
        if (demoUser.id === userId) {
            continue;
        }

        try {
            await Contact.create({
                owner: userId,
                user: demoUser._id,
            });
            contactsCreated++;
        } catch (error) {
            if (isDuplicateKeyError(error)) {
                contactsExisting++;
            } else {
                throw error;
            }
        }
    }

    return { contactsCreated, contactsExisting };
}

/**
 * Siembra la actividad inicial del usuario demo.
 * Al finalizar, las tres cuentas tienen EXACTAMENTE:
 * - EUR: 500,00 (50_000 céntimos tras descontar los 8 gastos de ejemplo)
 * - USD: 500,00 (50_000 céntimos de ingreso inicial)
 * - BRL: 500,00 (50_000 céntimos de ingreso inicial)
 */
export async function seedDemoActivity(
    userId: string,
    externalSession?: ClientSession,
): Promise<SeedActivityResult> {
    // Verificación rápida fuera de sesión solo si no nos pasan una sesión externa en curso
    if (!externalSession) {
        const hasPayments = await Movement.exists({ user: userId, type: "payment_out" });
        if (hasPayments) {
            return { executed: false, paymentsCreated: 0 };
        }
    }

    const executeInSession = async (session: ClientSession): Promise<SeedActivityResult> => {
        const alreadyHas = await Movement.exists({ user: userId, type: "payment_out" }).session(session);
        if (alreadyHas) {
            return { executed: false, paymentsCreated: 0 };
        }

        await ensureAccounts(userId, session);

        // Localizo el último movimiento para asegurar fechas estrictamente crecientes
        const lastMovement = await Movement.findOne({ user: userId })
            .sort({ createdAt: -1, _id: -1 })
            .session(session);

        let currentTimestamp = lastMovement
            ? lastMovement.createdAt.getTime() + 1000
            : Date.now() - 3600 * 1000 * 12;

        // 1. Ingreso inicial en USD (500,00 USD = 50_000 céntimos)
        currentTimestamp += 1000;
        await depositToAccount(userId, "USD", INITIAL_USD_CENTS, {
            session,
            createdAt: new Date(currentTimestamp),
        });

        // 2. Ingreso inicial en BRL (500,00 BRL = 50_000 céntimos)
        currentTimestamp += 1000;
        await depositToAccount(userId, "BRL", INITIAL_BRL_CENTS, {
            session,
            createdAt: new Date(currentTimestamp),
        });

        // 3. Ingreso inicial en EUR: 50_000 céntimos más la suma de los gastos de ejemplo (12_232 céntimos).
        // Total = 62_232 céntimos. Al estar por debajo del tope MAX_DEPOSIT_CENTS (1_000_000 céntimos),
        // cabe en un solo ingreso.
        const initialEurDepositCents = INITIAL_EUR_FINAL_CENTS + TOTAL_DEMO_PAYMENTS_CENTS;
        currentTimestamp += 1000;
        await depositToAccount(userId, "EUR", initialEurDepositCents, {
            session,
            createdAt: new Date(currentTimestamp),
        });

        const eurAccount = await Account.findOne({ user: userId, currency: "EUR" }).session(session);
        if (!eurAccount) {
            throw new Error("No se encontró la cuenta EUR tras el ingreso inicial.");
        }

        let runningEurBalance = eurAccount.balanceCents;

        // 4. 8 apuntes payment_out en EUR
        for (const payment of DEMO_PAYMENTS) {
            currentTimestamp += 1000;
            runningEurBalance -= payment.amountCents;

            await Movement.create(
                [
                    {
                        user: userId,
                        account: eurAccount._id,
                        currency: "EUR",
                        type: "payment_out",
                        amountCents: payment.amountCents,
                        balanceAfterCents: runningEurBalance,
                        merchantKey: payment.key,
                        createdAt: new Date(currentTimestamp),
                    },
                ],
                { session },
            );
        }

        // Actualizar saldo final de la cuenta EUR para coincidir exactamente con runningEurBalance (50_000 céntimos)
        await Account.updateOne(
            { _id: eurAccount._id },
            { balanceCents: runningEurBalance },
            { session },
        );

        return { executed: true, paymentsCreated: DEMO_PAYMENTS.length };
    };

    if (externalSession) {
        return executeInSession(externalSession);
    }

    const session = await mongoose.startSession();
    try {
        let result: SeedActivityResult = { executed: false, paymentsCreated: 0 };
        await session.withTransaction(async () => {
            result = await executeInSession(session);
        });
        return result;
    } finally {
        await session.endSession();
    }
}

export async function linkAllUsersToDemoContacts(): Promise<LinkAllContactsResult> {
    const allUsers = await User.find().select("_id");
    let totalContactsCreated = 0;
    let totalContactsExisting = 0;
    let totalActivitiesSeeded = 0;

    for (const user of allUsers) {
        const res = await ensureDemoContacts(user.id);
        totalContactsCreated += res.contactsCreated;
        totalContactsExisting += res.contactsExisting;

        const act = await seedDemoActivity(user.id);
        if (act.executed) {
            totalActivitiesSeeded++;
        }
    }

    return { totalContactsCreated, totalContactsExisting, totalActivitiesSeeded };
}
