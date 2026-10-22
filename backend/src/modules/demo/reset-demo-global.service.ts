import mongoose from "mongoose";
import { Account } from "../../models/account.model.js";
import { Contact } from "../../models/contact.model.js";
import { Holding } from "../../models/holding.model.js";
import { Movement } from "../../models/movement.model.js";
import { RefreshToken } from "../../models/refresh-token.model.js";
import { Trade } from "../../models/trade.model.js";
import { Transfer } from "../../models/transfer.model.js";
import { User } from "../../models/user.model.js";
import { hashPassword } from "../../utils/password.js";
import { ensureAccounts } from "../accounts/accounts.service.js";
import { registerUser } from "../auth/auth.service.js";
import {
    DEMO_USERS,
    INITIAL_BRL_CENTS,
    INITIAL_EUR_FINAL_CENTS,
    INITIAL_USD_CENTS,
    demoPassword,
} from "./demo-users.js";
import {
    DEMO_PAYMENTS,
    ensureDemoContacts,
    seedDemoActivity,
} from "./demo.service.js";

export type ResetDemoGlobalResult = {
    demoUsersRestored: number;
    totalUsersReset: number;
    accountsReset: number;
    movementsDeleted: number;
    transfersDeleted: number;
    holdingsDeleted: number;
    tradesDeleted: number;
    refreshTokensDeleted: number;
    contactsReset: number;
    demoExpensesPerUser: number;
    balancesPerUserCents: {
        EUR: number;
        USD: number;
        BRL: number;
    };
    usersSummary: Array<{
        demoNumber: number;
        name: string;
        email: string;
        avatarId: string;
        passwordDefault: string;
        eurCents: number;
        usdCents: number;
        brlCents: number;
        paymentsCount: number;
        holdingsCount: number;
    }>;
};

/**
 * Restablecimiento global y definitivo del estado de demostración.
 *
 * ALCANCE:
 * 1. Garantiza que los 9 usuarios canónicos de demostración existan con su
 *    nombre, avatar, correo (@gmail.com) y contraseña por defecto (Password101!...Password109!).
 * 2. Asegura que cada usuario tenga vinculados a los demás usuarios de demo como contactos.
 * 3. Ejecuta una transacción atómica que:
 *    - Elimina todas las posiciones de inversión (Holdings) -> Cartera vacía inicial.
 *    - Elimina todas las operaciones históricas bursátiles / cripto (Trades).
 *    - Elimina todas las transferencias previas (Transfers).
 *    - Elimina todos los movimientos anteriores (Movements).
 *    - Revoca todos los refresh tokens antiguos para un inicio limpio.
 *    - Restablece lastTransferredAt a null en todos los contactos.
 *    - Restablece el saldo de todas las cuentas a 0.
 *    - Re-siembra a cada usuario con la actividad demo oficial:
 *      * 500,00 USD de saldo inicial.
 *      * 500,00 BRL de saldo inicial.
 *      * 500,00 EUR de saldo disponible resultante tras abonar 622,32 EUR y
 *        descontar los 8 gastos en comercios demo (Netflix, Spotify, Starbucks, etc.)
 *        totalizando 122,32 EUR de gastos en su historial.
 */
export async function resetDemoGlobal(): Promise<ResetDemoGlobalResult> {
    // 1. Sincronizar los 9 usuarios canónicos de la demo fuera de la transacción principal
    let demoUsersRestored = 0;

    for (const demo of DEMO_USERS) {
        const canonicalPassword = demoPassword(demo);
        const existing = await User.findOne({ email: demo.email });

        if (!existing) {
            const created = await registerUser({
                name: demo.name,
                email: demo.email,
                password: canonicalPassword,
            });
            await User.updateOne(
                { _id: created.id },
                { $set: { avatarId: demo.avatarId } },
            );
            await ensureAccounts(created.id);
            demoUsersRestored++;
        } else {
            const passwordHash = await hashPassword(canonicalPassword);
            await User.updateOne(
                { _id: existing._id },
                {
                    $set: {
                        name: demo.name,
                        avatarId: demo.avatarId,
                        passwordHash,
                    },
                },
            );
            await ensureAccounts(existing.id);
            demoUsersRestored++;
        }
    }

    // 2. Asegurar que los contactos mutuos de demo existan para todos los usuarios
    const allCurrentUsers = await User.find().select("_id");
    for (const u of allCurrentUsers) {
        await ensureDemoContacts(u.id);
    }

    // 3. Ejecutar limpieza atómica y re-siembra contable dentro de una sesión
    const session = await mongoose.startSession();
    let movementsDeleted = 0;
    let transfersDeleted = 0;
    let holdingsDeleted = 0;
    let tradesDeleted = 0;
    let refreshTokensDeleted = 0;
    let contactsReset = 0;
    let totalUsersReset = 0;
    let accountsReset = 0;

    try {
        await session.withTransaction(async () => {
            // Borrado secuencial en la misma sesión
            const delMovements = await Movement.deleteMany({}, { session });
            movementsDeleted = delMovements.deletedCount ?? 0;

            const delTransfers = await Transfer.deleteMany({}, { session });
            transfersDeleted = delTransfers.deletedCount ?? 0;

            const delHoldings = await Holding.deleteMany({}, { session });
            holdingsDeleted = delHoldings.deletedCount ?? 0;

            const delTrades = await Trade.deleteMany({}, { session });
            tradesDeleted = delTrades.deletedCount ?? 0;

            const delTokens = await RefreshToken.deleteMany({}, { session });
            refreshTokensDeleted = delTokens.deletedCount ?? 0;

            const resContacts = await Contact.updateMany(
                {},
                { $set: { lastTransferredAt: null } },
                { session },
            );
            contactsReset = resContacts.modifiedCount ?? 0;

            // Restablecer saldos de todas las cuentas a 0
            const resAccounts = await Account.updateMany(
                {},
                { $set: { balanceCents: 0 } },
                { session },
            );
            accountsReset = resAccounts.modifiedCount ?? 0;

            // Re-sembrar actividad oficial para cada usuario
            const usersToSeed = await User.find().select("_id").session(session);
            totalUsersReset = usersToSeed.length;

            for (const user of usersToSeed) {
                await seedDemoActivity(user.id, session);
            }
        });
    } finally {
        await session.endSession();
    }

    // 4. Preparar resumen de comprobación de los usuarios demo
    const usersSummary = [];
    for (const demo of DEMO_USERS) {
        const u = await User.findOne({ email: demo.email }).select("_id name email avatarId");
        if (u) {
            const accounts = await Account.find({ user: u._id }).select("currency balanceCents");
            const eur = accounts.find((a) => a.currency === "EUR")?.balanceCents ?? 0;
            const usd = accounts.find((a) => a.currency === "USD")?.balanceCents ?? 0;
            const brl = accounts.find((a) => a.currency === "BRL")?.balanceCents ?? 0;
            const paymentsCount = await Movement.countDocuments({ user: u._id, type: "payment_out" });
            const holdingsCount = await Holding.countDocuments({ user: u._id });

            usersSummary.push({
                demoNumber: demo.demoNumber,
                name: u.name,
                email: u.email,
                avatarId: u.avatarId ?? demo.avatarId,
                passwordDefault: demoPassword(demo),
                eurCents: eur,
                usdCents: usd,
                brlCents: brl,
                paymentsCount,
                holdingsCount,
            });
        }
    }

    return {
        demoUsersRestored,
        totalUsersReset,
        accountsReset,
        movementsDeleted,
        transfersDeleted,
        holdingsDeleted,
        tradesDeleted,
        refreshTokensDeleted,
        contactsReset,
        demoExpensesPerUser: DEMO_PAYMENTS.length,
        balancesPerUserCents: {
            EUR: INITIAL_EUR_FINAL_CENTS,
            USD: INITIAL_USD_CENTS,
            BRL: INITIAL_BRL_CENTS,
        },
        usersSummary,
    };
}
