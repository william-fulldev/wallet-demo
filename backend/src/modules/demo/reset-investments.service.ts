import mongoose from "mongoose";
import { Account } from "../../models/account.model.js";
import { Holding } from "../../models/holding.model.js";
import { Movement, type MovementType } from "../../models/movement.model.js";
import { Trade } from "../../models/trade.model.js";
import { User } from "../../models/user.model.js";

export type UserResetPreview = {
    userId: string;
    name: string;
    email: string;
    holdingsCount: number;
    tradesCount: number;
    investmentBuysCount: number;
    investmentSellsCount: number;
    currentUsdBalanceCents: number;
    projectedUsdBalanceCents: number;
};

export type InvestmentResetPreview = {
    affectedUsers: UserResetPreview[];
    totalHoldings: number;
    totalTrades: number;
    totalInvestmentBuys: number;
    totalInvestmentSells: number;
};

export type UserResetResult = {
    userId: string;
    name: string;
    email: string;
    holdingsDeleted: number;
    tradesDeleted: number;
    investmentBuysDeleted: number;
    investmentSellsDeleted: number;
    usdBalanceBeforeCents: number;
    usdBalanceAfterCents: number;
};

export type UserResetAborted = {
    userId: string;
    name: string;
    email: string;
    reason: string;
};

export type InvestmentResetResult = {
    usersProcessed: UserResetResult[];
    usersAborted: UserResetAborted[];
    totalHoldingsDeleted: number;
    totalTradesDeleted: number;
    totalInvestmentBuysDeleted: number;
    totalInvestmentSellsDeleted: number;
};

/**
 * Devuelve la variación (delta) con signo que introduce un movimiento en la cuenta asociada.
 * Depósitos y recepciones/entradas suman; salidas y pagos restan.
 */
export function getMovementDeltaCents(type: MovementType, amountCents: number): number {
    switch (type) {
        case "deposit":
        case "transfer_in":
        case "exchange_in":
        case "investment_sell":
            return amountCents;
        case "transfer_out":
        case "exchange_out":
        case "payment_out":
        case "investment_buy":
            return -amountCents;
    }
}

/**
 * Obtiene la lista de identificadores de usuarios que tienen algún Holding, Trade
 * o apunte de tipo investment_buy / investment_sell.
 */
async function getAffectedUserIds(): Promise<string[]> {
    const [holdingOwners, tradeOwners, movementUsers] = await Promise.all([
        Holding.distinct("owner"),
        Trade.distinct("owner"),
        Movement.distinct("user", { type: { $in: ["investment_buy", "investment_sell"] } }),
    ]);

    const idsSet = new Set<string>();
    for (const id of [...holdingOwners, ...tradeOwners, ...movementUsers]) {
        if (id) {
            idsSet.add(id.toString());
        }
    }

    return Array.from(idsSet);
}

/**
 * Simulación de limpieza: devuelve lo que se borraría y el saldo proyectado sin modificar nada.
 */
export async function previewInvestmentReset(): Promise<InvestmentResetPreview> {
    const userIds = await getAffectedUserIds();
    const affectedUsers: UserResetPreview[] = [];

    let totalHoldings = 0;
    let totalTrades = 0;
    let totalInvestmentBuys = 0;
    let totalInvestmentSells = 0;

    for (const userId of userIds) {
        const user = await User.findById(userId);
        if (!user) continue;

        const [holdingsCount, tradesCount, investmentBuysCount, investmentSellsCount] = await Promise.all([
            Holding.countDocuments({ owner: userId }),
            Trade.countDocuments({ owner: userId }),
            Movement.countDocuments({ user: userId, type: "investment_buy" }),
            Movement.countDocuments({ user: userId, type: "investment_sell" }),
        ]);

        const usdAccount = await Account.findOne({ user: userId, currency: "USD" });
        const currentUsdBalanceCents = usdAccount?.balanceCents ?? 0;

        // Recalcular la cadena proyectada sin investment_buy ni investment_sell
        let projectedUsdBalanceCents = currentUsdBalanceCents;
        if (usdAccount) {
            const remainingMovements = await Movement.find({
                user: userId,
                account: usdAccount._id,
                type: { $nin: ["investment_buy", "investment_sell"] },
            }).sort({ _id: 1 });

            let running = 0;
            for (const m of remainingMovements) {
                running += getMovementDeltaCents(m.type, m.amountCents);
            }
            projectedUsdBalanceCents = running;
        }

        affectedUsers.push({
            userId,
            name: user.name,
            email: user.email,
            holdingsCount,
            tradesCount,
            investmentBuysCount,
            investmentSellsCount,
            currentUsdBalanceCents,
            projectedUsdBalanceCents,
        });

        totalHoldings += holdingsCount;
        totalTrades += tradesCount;
        totalInvestmentBuys += investmentBuysCount;
        totalInvestmentSells += investmentSellsCount;
    }

    return {
        affectedUsers,
        totalHoldings,
        totalTrades,
        totalInvestmentBuys,
        totalInvestmentSells,
    };
}

/**
 * Ejecuta la limpieza segura de inversiones:
 * Para cada usuario afectado, en UNA transacción atómica:
 * 1. Borra sus Holding, Trade y movimientos investment_buy / investment_sell.
 * 2. Recalcula la cadena de la cuenta USD en orden cronológico (_id: 1), actualizando balanceAfterCents.
 * 3. Fija balanceCents de la cuenta USD al resultado final de la cadena.
 * Aborta la transacción del usuario si en algún momento el saldo recalculado fuera negativo.
 */
export async function applyInvestmentReset(): Promise<InvestmentResetResult> {
    const userIds = await getAffectedUserIds();
    const usersProcessed: UserResetResult[] = [];
    const usersAborted: UserResetAborted[] = [];

    let totalHoldingsDeleted = 0;
    let totalTradesDeleted = 0;
    let totalInvestmentBuysDeleted = 0;
    let totalInvestmentSellsDeleted = 0;

    for (const userId of userIds) {
        const user = await User.findById(userId);
        if (!user) continue;

        const session = await mongoose.startSession();
        try {
            await session.withTransaction(async () => {
                const usdAccount = await Account.findOne({ user: userId, currency: "USD" }).session(session);
                const usdBalanceBeforeCents = usdAccount?.balanceCents ?? 0;

                const [holdingRes, tradeRes, movementBuyRes, movementSellRes] = await Promise.all([
                    Holding.deleteMany({ owner: userId }).session(session),
                    Trade.deleteMany({ owner: userId }).session(session),
                    Movement.deleteMany({ user: userId, type: "investment_buy" }).session(session),
                    Movement.deleteMany({ user: userId, type: "investment_sell" }).session(session),
                ]);

                let usdBalanceAfterCents = usdBalanceBeforeCents;

                if (usdAccount) {
                    const remainingMovements = await Movement.find({
                        user: userId,
                        account: usdAccount._id,
                    })
                        .sort({ _id: 1 })
                        .session(session);

                    let running = 0;
                    for (const m of remainingMovements) {
                        const delta = getMovementDeltaCents(m.type, m.amountCents);
                        running += delta;
                        if (running < 0) {
                            throw new Error(
                                `Saldo negativo recalculado (${running} céntimos) para el usuario ${user.email} en el apunte ${m._id}`,
                            );
                        }
                        m.balanceAfterCents = running;
                        await m.save({ session });
                    }

                    usdAccount.balanceCents = running;
                    await usdAccount.save({ session });
                    usdBalanceAfterCents = running;
                }

                usersProcessed.push({
                    userId,
                    name: user.name,
                    email: user.email,
                    holdingsDeleted: holdingRes.deletedCount ?? 0,
                    tradesDeleted: tradeRes.deletedCount ?? 0,
                    investmentBuysDeleted: movementBuyRes.deletedCount ?? 0,
                    investmentSellsDeleted: movementSellRes.deletedCount ?? 0,
                    usdBalanceBeforeCents,
                    usdBalanceAfterCents,
                });

                totalHoldingsDeleted += holdingRes.deletedCount ?? 0;
                totalTradesDeleted += tradeRes.deletedCount ?? 0;
                totalInvestmentBuysDeleted += movementBuyRes.deletedCount ?? 0;
                totalInvestmentSellsDeleted += movementSellRes.deletedCount ?? 0;
            });
        } catch (error: any) {
            usersAborted.push({
                userId,
                name: user.name,
                email: user.email,
                reason: error?.message ?? String(error),
            });
        } finally {
            await session.endSession();
        }
    }

    return {
        usersProcessed,
        usersAborted,
        totalHoldingsDeleted,
        totalTradesDeleted,
        totalInvestmentBuysDeleted,
        totalInvestmentSellsDeleted,
    };
}
