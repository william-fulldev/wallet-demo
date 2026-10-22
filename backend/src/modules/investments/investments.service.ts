import mongoose from "mongoose";
import { Account } from "../../models/account.model.js";
import { Holding } from "../../models/holding.model.js";
import { Movement } from "../../models/movement.model.js";
import { Trade } from "../../models/trade.model.js";
import { isDuplicateKeyError } from "../../utils/mongo-errors.js";
import {
    AccountNotFoundError,
    toPublicAccount,
    toPublicMovement,
    type PublicAccount,
    type PublicMovement,
} from "../accounts/accounts.service.js";
import {
    FALLBACK_QUOTES,
    getAssetDefinition,
} from "../market/market.catalog.js";
import { getAssetQuote } from "../market/market.service.js";
import type { SellInvestmentInput } from "./investments.schemas.js";

export class UnknownAssetError extends Error {
    constructor(message = "Ese activo no está en el catálogo.") {
        super(message);
        this.name = "UnknownAssetError";
    }
}

export class InsufficientFundsError extends Error {
    constructor(
        message = "Saldo insuficiente en USD. Puedes cambiar EUR a USD en la sección de cambio.",
    ) {
        super(message);
        this.name = "InsufficientFundsError";
    }
}

export class InsufficientUnitsError extends Error {
    constructor(message = "No tienes suficientes unidades para realizar la venta.") {
        super(message);
        this.name = "InsufficientUnitsError";
    }
}

export class AmountTooSmallError extends Error {
    constructor(
        message = "El importe es demasiado pequeño: al calcular las unidades se obtendría 0.",
    ) {
        super(message);
        this.name = "AmountTooSmallError";
    }
}

export class IdempotencyKeyReusedError extends Error {
    constructor(message = "Esa clave de idempotencia ya se usó con otros datos.") {
        super(message);
        this.name = "IdempotencyKeyReusedError";
    }
}

export type PublicHolding = {
    symbol: string;
    unitsE8: number;
    investedCents: number;
};

export type BuyInvestmentResult = {
    tradeId: string;
    account: PublicAccount;
    movement: PublicMovement;
    holding: PublicHolding;
    replayed: boolean;
};

export type SellInvestmentResult = {
    tradeId: string;
    account: PublicAccount;
    movement: PublicMovement;
    holding: PublicHolding | null;
    realizedPnlCents: number;
    replayed: boolean;
};

export type InvestmentPosition = {
    symbol: string;
    name: string;
    unitsE8: number;
    investedCents: number;
    valueCents: number;
    pnlCents: number;
};

async function findReplay(
    userId: string,
    symbol: string,
    amountCents: number,
    idempotencyKey: string,
): Promise<BuyInvestmentResult | null> {
    const existing = await Trade.findOne({ owner: userId, idempotencyKey });
    if (!existing) {
        return null;
    }

    const sameRequest =
        existing.side === "buy" && existing.symbol === symbol && existing.amountCents === amountCents;
    if (!sameRequest) {
        throw new IdempotencyKeyReusedError();
    }

    const movement = await Movement.findOne({ tradeId: existing._id, user: userId });
    const account = await Account.findOne({ user: userId, currency: "USD" });
    const holding = await Holding.findOne({ owner: userId, symbol });

    if (!movement || !account || !holding) {
        throw new Error("La operación existe pero faltan datos asociados.");
    }

    return {
        tradeId: existing.id,
        account: toPublicAccount(account),
        movement: toPublicMovement(movement),
        holding: {
            symbol: holding.symbol,
            unitsE8: holding.unitsE8,
            investedCents: holding.investedCents,
        },
        replayed: true,
    };
}

export async function buyInvestment(
    userId: string,
    input: { symbol: string; amountCents: number; idempotencyKey: string },
): Promise<BuyInvestmentResult> {
    const symbol = input.symbol.trim().toUpperCase();
    const assetDef = getAssetDefinition(symbol);
    if (!assetDef) {
        throw new UnknownAssetError();
    }

    const replay = await findReplay(userId, symbol, input.amountCents, input.idempotencyKey);
    if (replay) {
        return replay;
    }

    const quote = await getAssetQuote(symbol);
    const unitsE8 = Math.floor((input.amountCents * 1e8) / quote.priceCents);

    if (unitsE8 <= 0) {
        throw new AmountTooSmallError();
    }

    const session = await mongoose.startSession();
    let result: BuyInvestmentResult | null = null;

    try {
        await session.withTransaction(async () => {
            // 1. Registro maestro Trade primero
            const [trade] = await Trade.create(
                [
                    {
                        owner: userId,
                        symbol,
                        side: "buy",
                        amountCents: input.amountCents,
                        priceCents: quote.priceCents,
                        unitsE8,
                        priceSource: quote.source,
                        idempotencyKey: input.idempotencyKey,
                    },
                ],
                { session },
            );

            // 2. Débito condicionado de la cuenta USD con balanceCents >= amountCents
            const account = await Account.findOneAndUpdate(
                { user: userId, currency: "USD", balanceCents: { $gte: input.amountCents } },
                { $inc: { balanceCents: -input.amountCents } },
                { returnDocument: "after", session },
            );

            if (!account) {
                const exists = await Account.exists({ user: userId, currency: "USD" }).session(session);
                if (!exists) {
                    throw new AccountNotFoundError("Cuenta en USD no encontrada.");
                }
                throw new InsufficientFundsError();
            }

            // 3. Upsert del Holding con $inc de unitsE8 e investedCents
            const holding = await Holding.findOneAndUpdate(
                { owner: userId, symbol },
                { $inc: { unitsE8, investedCents: input.amountCents } },
                { upsert: true, returnDocument: "after", session },
            );

            if (!holding) {
                throw new Error("No se pudo actualizar la posición de inversión.");
            }

            // 4. Apunte investment_buy con asset y balanceAfterCents
            const [movement] = await Movement.create(
                [
                    {
                        user: userId,
                        account: account._id,
                        currency: "USD",
                        type: "investment_buy",
                        amountCents: input.amountCents,
                        balanceAfterCents: account.balanceCents,
                        tradeId: trade._id,
                        asset: {
                            symbol: assetDef.symbol,
                            name: assetDef.name,
                        },
                    },
                ],
                { session },
            );

            result = {
                tradeId: trade.id,
                account: toPublicAccount(account),
                movement: toPublicMovement(movement),
                holding: {
                    symbol: holding.symbol,
                    unitsE8: holding.unitsE8,
                    investedCents: holding.investedCents,
                },
                replayed: false,
            };
        });
    } catch (error) {
        if (isDuplicateKeyError(error)) {
            const again = await findReplay(userId, symbol, input.amountCents, input.idempotencyKey);
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

async function findSellReplay(
    userId: string,
    input: SellInvestmentInput,
    idempotencyKey: string,
): Promise<SellInvestmentResult | null> {
    const existing = await Trade.findOne({ owner: userId, idempotencyKey });
    if (!existing) {
        return null;
    }

    const symbol = input.symbol.trim().toUpperCase();
    if (existing.side !== "sell" || existing.symbol !== symbol) {
        throw new IdempotencyKeyReusedError();
    }

    if ("all" in input && input.all) {
        if (!existing.isAll) {
            throw new IdempotencyKeyReusedError();
        }
    } else if ("amountCents" in input) {
        if (existing.isAll || existing.amountCents !== input.amountCents) {
            throw new IdempotencyKeyReusedError();
        }
    }

    const movement = await Movement.findOne({ tradeId: existing._id, user: userId });
    const account = await Account.findOne({ user: userId, currency: "USD" });
    const holding = await Holding.findOne({ owner: userId, symbol });

    if (!movement || !account) {
        throw new Error("La operación existe pero faltan datos asociados.");
    }

    const publicHolding: PublicHolding | null =
        holding && holding.unitsE8 > 0
            ? {
                  symbol: holding.symbol,
                  unitsE8: holding.unitsE8,
                  investedCents: holding.investedCents,
              }
            : null;

    return {
        tradeId: existing.id,
        account: toPublicAccount(account),
        movement: toPublicMovement(movement),
        holding: publicHolding,
        realizedPnlCents: existing.realizedPnlCents ?? 0,
        replayed: true,
    };
}

export async function sellInvestment(
    userId: string,
    input: SellInvestmentInput & { idempotencyKey: string },
): Promise<SellInvestmentResult> {
    const symbol = input.symbol.trim().toUpperCase();
    const assetDef = getAssetDefinition(symbol);
    if (!assetDef) {
        throw new UnknownAssetError();
    }

    const replay = await findSellReplay(userId, input, input.idempotencyKey);
    if (replay) {
        return replay;
    }

    const currentHolding = await Holding.findOne({ owner: userId, symbol });
    if (!currentHolding || currentHolding.unitsE8 <= 0) {
        throw new InsufficientUnitsError("No tienes ninguna posición en este activo.");
    }

    const quote = await getAssetQuote(symbol);
    const priceCents = quote.priceCents;

    let unitsToSell: number;
    let moneyReceived: number;

    if ("amountCents" in input) {
        const amountCents = input.amountCents;
        // unitsE8 = ceil(amountCents * 1e8 / priceCents)
        const num = BigInt(amountCents) * 100_000_000n;
        const den = BigInt(priceCents);
        const unitsToSellBig = (num + den - 1n) / den;
        unitsToSell = Number(unitsToSellBig);

        if (unitsToSell <= 0) {
            throw new AmountTooSmallError("El importe es demasiado pequeño.");
        }
        if (currentHolding.unitsE8 < unitsToSell) {
            throw new InsufficientUnitsError("No dispones de suficientes unidades para vender ese importe.");
        }
        moneyReceived = amountCents;
    } else {
        unitsToSell = currentHolding.unitsE8;
        // Math.round(unitsE8 * priceCents / 1e8) calculado con BigInt
        const product = BigInt(unitsToSell) * BigInt(priceCents);
        moneyReceived = Number((product + 50_000_000n) / 100_000_000n);
        if (moneyReceived < 1) {
            throw new AmountTooSmallError("El valor de la posición es inferior a 1 céntimo.");
        }
    }

    const session = await mongoose.startSession();
    let result: SellInvestmentResult | null = null;

    try {
        await session.withTransaction(async () => {
            const holding = await Holding.findOne({ owner: userId, symbol }).session(session);
            if (!holding || holding.unitsE8 <= 0) {
                throw new InsufficientUnitsError("No tienes ninguna posición en este activo.");
            }

            let effectiveUnitsToSell = unitsToSell;
            let effectiveMoneyReceived = moneyReceived;

            if ("all" in input && input.all) {
                effectiveUnitsToSell = holding.unitsE8;
                const prod = BigInt(effectiveUnitsToSell) * BigInt(priceCents);
                effectiveMoneyReceived = Number((prod + 50_000_000n) / 100_000_000n);
                if (effectiveMoneyReceived < 1) {
                    throw new AmountTooSmallError("El valor de la posición es inferior a 1 céntimo.");
                }
            }

            if (holding.unitsE8 < effectiveUnitsToSell) {
                throw new InsufficientUnitsError("No dispones de suficientes unidades para completar la venta.");
            }

            let costReduction: number;
            if (effectiveUnitsToSell === holding.unitsE8) {
                costReduction = holding.investedCents;
            } else {
                const costNum = BigInt(holding.investedCents) * BigInt(effectiveUnitsToSell);
                const costDen = BigInt(holding.unitsE8);
                costReduction = Number((costNum + (costDen / 2n)) / costDen);
                if (costReduction > holding.investedCents) {
                    costReduction = holding.investedCents;
                }
                if (costReduction < 0) {
                    costReduction = 0;
                }
            }

            const realizedPnlCents = effectiveMoneyReceived - costReduction;

            // 1. Registro maestro Trade primero
            const [trade] = await Trade.create(
                [
                    {
                        owner: userId,
                        symbol,
                        side: "sell",
                        amountCents: effectiveMoneyReceived,
                        priceCents,
                        unitsE8: effectiveUnitsToSell,
                        priceSource: quote.source,
                        idempotencyKey: input.idempotencyKey,
                        isAll: Boolean("all" in input && input.all),
                        realizedPnlCents,
                    },
                ],
                { session },
            );

            // 2. Descuenta las unidades de forma condicionada y atómica:
            // filtro owner + symbol + unitsE8 >= unidades a vender, con $inc negativo.
            const updatedHolding = await Holding.findOneAndUpdate(
                {
                    owner: userId,
                    symbol,
                    unitsE8: { $gte: effectiveUnitsToSell },
                },
                {
                    $inc: {
                        unitsE8: -effectiveUnitsToSell,
                        investedCents: -costReduction,
                    },
                },
                { returnDocument: "after", session },
            );

            if (!updatedHolding) {
                throw new InsufficientUnitsError("No dispones de suficientes unidades para completar la venta.");
            }

            // 4. Si la posición queda en cero unidades, elimínala
            let finalHolding: PublicHolding | null = null;
            if (updatedHolding.unitsE8 <= 0) {
                await Holding.deleteOne({ _id: updatedHolding._id }, { session });
                finalHolding = null;
            } else {
                if (updatedHolding.investedCents < 0) {
                    updatedHolding.investedCents = 0;
                    await updatedHolding.save({ session });
                }
                finalHolding = {
                    symbol: updatedHolding.symbol,
                    unitsE8: updatedHolding.unitsE8,
                    investedCents: updatedHolding.investedCents,
                };
            }

            // 5. Acredita el dinero en la cuenta USD con $inc y crea un apunte investment_sell
            const account = await Account.findOneAndUpdate(
                { user: userId, currency: "USD" },
                { $inc: { balanceCents: effectiveMoneyReceived } },
                { returnDocument: "after", session },
            );

            if (!account) {
                throw new AccountNotFoundError("Cuenta en USD no encontrada.");
            }

            const [movement] = await Movement.create(
                [
                    {
                        user: userId,
                        account: account._id,
                        currency: "USD",
                        type: "investment_sell",
                        amountCents: effectiveMoneyReceived,
                        balanceAfterCents: account.balanceCents,
                        tradeId: trade._id,
                        asset: {
                            symbol: assetDef.symbol,
                            name: assetDef.name,
                        },
                    },
                ],
                { session },
            );

            result = {
                tradeId: trade.id,
                account: toPublicAccount(account),
                movement: toPublicMovement(movement),
                holding: finalHolding,
                realizedPnlCents,
                replayed: false,
            };
        });
    } catch (error) {
        if (isDuplicateKeyError(error)) {
            const again = await findSellReplay(userId, input, input.idempotencyKey);
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

export async function listInvestments(userId: string): Promise<InvestmentPosition[]> {
    const holdings = await Holding.find({ owner: userId, unitsE8: { $gt: 0 } }).sort({ symbol: 1 });
    const positions: InvestmentPosition[] = [];

    for (const holding of holdings) {
        const assetDef = getAssetDefinition(holding.symbol);
        const name = assetDef ? assetDef.name : holding.symbol;
        let priceCents: number;

        try {
            const quote = await getAssetQuote(holding.symbol);
            priceCents = quote.priceCents;
        } catch {
            const fallback = FALLBACK_QUOTES[holding.symbol];
            priceCents = fallback ? fallback.priceCents : 10_000;
        }

        const product = BigInt(holding.unitsE8) * BigInt(priceCents);
        const valueCents = Number((product + 50_000_000n) / 100_000_000n);
        const pnlCents = valueCents - holding.investedCents;

        positions.push({
            symbol: holding.symbol,
            name,
            unitsE8: holding.unitsE8,
            investedCents: holding.investedCents,
            valueCents,
            pnlCents,
        });
    }

    return positions;
}
