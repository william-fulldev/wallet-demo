import mongoose from "mongoose";
import { Account } from "../../models/account.model.js";
import { Contact } from "../../models/contact.model.js";
import { Holding } from "../../models/holding.model.js";
import { Movement } from "../../models/movement.model.js";
import { Trade } from "../../models/trade.model.js";
import { Transfer } from "../../models/transfer.model.js";
import { User } from "../../models/user.model.js";
import {
    INITIAL_BRL_CENTS,
    INITIAL_EUR_FINAL_CENTS,
    INITIAL_USD_CENTS,
} from "./demo-users.js";
import { seedDemoActivity } from "./demo.service.js";

export type UserMoneyPreview = {
    id: string;
    name: string;
    email: string;
    currentEurCents: number;
    currentUsdCents: number;
    currentBrlCents: number;
    projectedEurCents: number;
    projectedUsdCents: number;
    projectedBrlCents: number;
};

export type DemoMoneyResetPreview = {
    totalUsers: number;
    totalAccounts: number;
    totalMovements: number;
    totalTransfers: number;
    totalHoldings: number;
    totalTrades: number;
    totalContactsWithLastTransferredAt: number;
    users: UserMoneyPreview[];
};

export type DemoMoneyResetResult = {
    usersReset: number;
    movementsDeleted: number;
    transfersDeleted: number;
    holdingsDeleted: number;
    tradesDeleted: number;
    contactsReset: number;
};

/**
 * Simulación de reinicio de dinero:
 * Consulta los documentos que serían eliminados y el estado final previsto
 * sin modificar ningún dato en la base de datos.
 */
export async function previewDemoMoneyReset(): Promise<DemoMoneyResetPreview> {
    const [
        totalUsers,
        totalAccounts,
        totalMovements,
        totalTransfers,
        totalHoldings,
        totalTrades,
        totalContactsWithLastTransferredAt,
        users,
        accounts,
    ] = await Promise.all([
        User.countDocuments(),
        Account.countDocuments(),
        Movement.countDocuments(),
        Transfer.countDocuments(),
        Holding.countDocuments(),
        Trade.countDocuments(),
        Contact.countDocuments({ lastTransferredAt: { $ne: null } }),
        User.find().select("name email"),
        Account.find().select("user currency balanceCents"),
    ]);

    // Mapeo de saldos por usuario y moneda
    const balancesByUser = new Map<string, Record<string, number>>();
    for (const acc of accounts) {
        const uId = acc.user.toString();
        const currentMap = balancesByUser.get(uId) ?? {};
        currentMap[acc.currency] = acc.balanceCents;
        balancesByUser.set(uId, currentMap);
    }

    const previewUsers: UserMoneyPreview[] = users.map((u) => {
        const userBalances = balancesByUser.get(u.id) ?? {};
        return {
            id: u.id,
            name: u.name,
            email: u.email,
            currentEurCents: userBalances.EUR ?? 0,
            currentUsdCents: userBalances.USD ?? 0,
            currentBrlCents: userBalances.BRL ?? 0,
            projectedEurCents: INITIAL_EUR_FINAL_CENTS,
            projectedUsdCents: INITIAL_USD_CENTS,
            projectedBrlCents: INITIAL_BRL_CENTS,
        };
    });

    return {
        totalUsers,
        totalAccounts,
        totalMovements,
        totalTransfers,
        totalHoldings,
        totalTrades,
        totalContactsWithLastTransferredAt,
        users: previewUsers,
    };
}

/**
 * Reinicio total del dinero y transacciones de la demo.
 *
 * ALCANCE: DELIBERADAMENTE GLOBAL.
 * Las transferencias unen a dos usuarios (emisor y receptor) con apuntes vinculados.
 * Un reinicio parcial por usuario rompería la integridad referencial y contable.
 *
 * DECISIÓN TRANSACCIONAL:
 * Se realiza en una única transacción atómica en MongoDB. Si cualquier paso fallase,
 * la transacción completa se revierte, impidiendo estados intermedios inconsistentes.
 *
 * OPERACIONES:
 * 1. Elimina todos los Movement, Transfer, Holding y Trade.
 * 2. Restablece el saldo de todas las Account a 0.
 * 3. Restablece lastTransferredAt de todos los Contact a null.
 * 4. Vuelve a sembrar a cada usuario existente con seedDemoActivity(userId, session).
 * 5. Conserva intactos: usuarios, contraseñas, tokens de refresco, contactos y avatares.
 */
export async function applyDemoMoneyReset(): Promise<DemoMoneyResetResult> {
    const session = await mongoose.startSession();
    let result: DemoMoneyResetResult = {
        usersReset: 0,
        movementsDeleted: 0,
        transfersDeleted: 0,
        holdingsDeleted: 0,
        tradesDeleted: 0,
        contactsReset: 0,
    };

    try {
        await session.withTransaction(async () => {
            // 1. Borrar colecciones operativas secuencialmente (en una sesión de MongoDB no deben ejecutarse en paralelo)
            const delMovements = await Movement.deleteMany({}, { session });
            const delTransfers = await Transfer.deleteMany({}, { session });
            const delHoldings = await Holding.deleteMany({}, { session });
            const delTrades = await Trade.deleteMany({}, { session });
            const resContacts = await Contact.updateMany({}, { $set: { lastTransferredAt: null } }, { session });

            // 2. Restablecer saldos a 0
            await Account.updateMany({}, { $set: { balanceCents: 0 } }, { session });

            // 3. Volver a sembrar a todos los usuarios existentes dentro de la misma transacción
            const allUsers = await User.find().select("_id").session(session);

            for (const user of allUsers) {
                await seedDemoActivity(user.id, session);
            }

            result = {
                usersReset: allUsers.length,
                movementsDeleted: delMovements.deletedCount ?? 0,
                transfersDeleted: delTransfers.deletedCount ?? 0,
                holdingsDeleted: delHoldings.deletedCount ?? 0,
                tradesDeleted: delTrades.deletedCount ?? 0,
                contactsReset: resContacts.modifiedCount ?? 0,
            };
        });
    } finally {
        await session.endSession();
    }

    return result;
}
