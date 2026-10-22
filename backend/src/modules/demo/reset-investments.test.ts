import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../../app.js";
import { Account } from "../../models/account.model.js";
import { Holding } from "../../models/holding.model.js";
import { Movement } from "../../models/movement.model.js";
import { Trade } from "../../models/trade.model.js";
import { authHeader, createTestUser, fund, type TestUser } from "../../test/helpers.js";
import type { MarketProvider } from "../market/market.provider.js";
import { clearMarketCache, resetMarketProvider, setMarketProvider } from "../market/market.service.js";
import {
    applyInvestmentReset,
    getMovementDeltaCents,
    previewInvestmentReset,
} from "./reset-investments.service.js";

function setupMockPrices(prices: Record<string, number> = { AAPL: 20_000, BTC: 6_000_000 }) {
    const mockProvider: MarketProvider = {
        getQuotes: vi.fn(async () =>
            Object.entries(prices).map(([symbol, priceCents]) => ({
                symbol,
                priceCents,
                changePct: 0,
                source: "live" as const,
                updatedAt: new Date().toISOString(),
            })),
        ),
    };
    setMarketProvider(mockProvider);
}

function buy(user: TestUser, symbol: string, amountCents: number, key: string) {
    return request(app)
        .post("/api/investments/buy")
        .set(authHeader(user))
        .set("Idempotency-Key", key)
        .send({ symbol, amountCents });
}

function exchange(user: TestUser, from: string, to: string, amountCents: number) {
    return request(app)
        .post("/api/accounts/exchange")
        .set(authHeader(user))
        .send({ from, to, amountCents });
}

function sell(user: TestUser, body: object, key: string) {
    return request(app)
        .post("/api/investments/sell")
        .set(authHeader(user))
        .set("Idempotency-Key", key)
        .send(body);
}

describe("reset-investments service", () => {
    beforeEach(() => {
        clearMarketCache();
        resetMarketProvider();
        setupMockPrices();
    });

    afterEach(() => {
        clearMarketCache();
        resetMarketProvider();
    });

    it("getMovementDeltaCents asigna signos correctos según la dirección del movimiento", () => {
        expect(getMovementDeltaCents("deposit", 1000)).toBe(1000);
        expect(getMovementDeltaCents("transfer_in", 2000)).toBe(2000);
        expect(getMovementDeltaCents("exchange_in", 3000)).toBe(3000);
        expect(getMovementDeltaCents("transfer_out", 1500)).toBe(-1500);
        expect(getMovementDeltaCents("exchange_out", 2500)).toBe(-2500);
        expect(getMovementDeltaCents("payment_out", 500)).toBe(-500);
        expect(getMovementDeltaCents("investment_buy", 4000)).toBe(-4000);
    });

    it("vista previa y limpieza con usuario que ingresa en USD, realiza dos compras y un cambio posterior", async () => {
        const user = await createTestUser("Inversor Reset");

        // 1. Ingreso de 1000,00 USD (100.000 céntimos)
        await fund(user, "USD", 100_000);

        // 2. Dos compras de prueba: AAPL por 100,00 USD y BTC por 200,00 USD
        const buy1 = await buy(user, "AAPL", 10_000, "key-reset-buy-1");
        expect(buy1.status).toBe(201);

        const buy2 = await buy(user, "BTC", 20_000, "key-reset-buy-2");
        expect(buy2.status).toBe(201);

        // 3. Cambio de moneda posterior: 150,00 USD (15.000 céntimos) a EUR
        const exRes = await exchange(user, "USD", "EUR", 15_000);
        expect(exRes.status).toBe(201);

        // Saldo USD actual: 100_000 - 10_000 - 20_000 - 15_000 = 55_000 céntimos
        const usdAccBefore = await Account.findOne({ user: user.id, currency: "USD" });
        expect(usdAccBefore?.balanceCents).toBe(55_000);

        // 4. Vista previa de la limpieza
        const preview = await previewInvestmentReset();
        expect(preview.affectedUsers).toHaveLength(1);

        const previewUser = preview.affectedUsers[0];
        expect(previewUser.userId).toBe(user.id);
        expect(previewUser.holdingsCount).toBe(2);
        expect(previewUser.tradesCount).toBe(2);
        expect(previewUser.investmentBuysCount).toBe(2);
        expect(previewUser.currentUsdBalanceCents).toBe(55_000);
        // Proyectado sin compras: 100_000 (depósito) - 15_000 (cambio) = 85_000 céntimos
        expect(previewUser.projectedUsdBalanceCents).toBe(85_000);

        // Comprobación de que la vista previa NO modificó nada
        expect(await Holding.countDocuments({ owner: user.id })).toBe(2);
        expect(await Trade.countDocuments({ owner: user.id })).toBe(2);
        expect(await Movement.countDocuments({ user: user.id, type: "investment_buy" })).toBe(2);

        // 5. Aplicar limpieza
        const result = await applyInvestmentReset();
        expect(result.usersProcessed).toHaveLength(1);
        expect(result.usersAborted).toHaveLength(0);

        const processed = result.usersProcessed[0];
        expect(processed.userId).toBe(user.id);
        expect(processed.holdingsDeleted).toBe(2);
        expect(processed.tradesDeleted).toBe(2);
        expect(processed.investmentBuysDeleted).toBe(2);
        expect(processed.usdBalanceBeforeCents).toBe(55_000);
        expect(processed.usdBalanceAfterCents).toBe(85_000);

        // 6. Verificación en base de datos tras la limpieza
        // Holding, Trade y apuntes investment_buy eliminados
        expect(await Holding.countDocuments({ owner: user.id })).toBe(0);
        expect(await Trade.countDocuments({ owner: user.id })).toBe(0);
        expect(await Movement.countDocuments({ user: user.id, type: "investment_buy" })).toBe(0);

        // Saldo USD actualizado a 85_000
        const usdAccAfter = await Account.findOne({ user: user.id, currency: "USD" });
        expect(usdAccAfter?.balanceCents).toBe(85_000);

        // Apuntes restantes en la cuenta USD: sólo deposit y exchange_out
        const remainingMovements = await Movement.find({
            user: user.id,
            account: usdAccAfter!._id,
        }).sort({ _id: 1 });

        expect(remainingMovements).toHaveLength(2);
        expect(remainingMovements[0].type).toBe("deposit");
        expect(remainingMovements[0].balanceAfterCents).toBe(100_000);

        expect(remainingMovements[1].type).toBe("exchange_out");
        expect(remainingMovements[1].balanceAfterCents).toBe(85_000);

        // Recorrerlos en orden cronológico (_id: 1) parte de 0 y da el saldo final de la cuenta
        let runningBalance = 0;
        for (const m of remainingMovements) {
            runningBalance += getMovementDeltaCents(m.type, m.amountCents);
            expect(m.balanceAfterCents).toBe(runningBalance);
        }
        expect(runningBalance).toBe(usdAccAfter?.balanceCents);

        // El apunte exchange_in en EUR no se tocó
        const eurMovements = await Movement.find({ user: user.id, currency: "EUR" });
        expect(eurMovements.length).toBeGreaterThan(0);
    });

    it("es idempotente: una segunda ejecución no cambia nada", async () => {
        const user = await createTestUser("Inversor Idempotente");
        await fund(user, "USD", 50_000);
        await buy(user, "AAPL", 10_000, "key-idemp-reset-1");

        // Primera ejecución
        const first = await applyInvestmentReset();
        expect(first.usersProcessed).toHaveLength(1);
        expect(first.totalHoldingsDeleted).toBe(1);
        expect(first.totalTradesDeleted).toBe(1);
        expect(first.totalInvestmentBuysDeleted).toBe(1);

        // Segunda ejecución inmediata
        const second = await applyInvestmentReset();
        expect(second.usersProcessed).toHaveLength(0);
        expect(second.usersAborted).toHaveLength(0);
        expect(second.totalHoldingsDeleted).toBe(0);
        expect(second.totalTradesDeleted).toBe(0);
        expect(second.totalInvestmentBuysDeleted).toBe(0);

        const usdAcc = await Account.findOne({ user: user.id, currency: "USD" });
        expect(usdAcc?.balanceCents).toBe(50_000);
    });

    it("no toca a otro usuario sin inversiones ni altera sus saldos o apuntes", async () => {
        const investor = await createTestUser("Usuario Con Inversiones");
        await fund(investor, "USD", 50_000);
        await buy(investor, "AAPL", 10_000, "key-reset-user-inv");

        const normalUser = await createTestUser("Usuario Sin Inversiones");
        await fund(normalUser, "USD", 40_000);
        await fund(normalUser, "EUR", 20_000);

        const normalUsdBefore = await Account.findOne({ user: normalUser.id, currency: "USD" });
        const normalEurBefore = await Account.findOne({ user: normalUser.id, currency: "EUR" });
        const normalMovementsBefore = await Movement.countDocuments({ user: normalUser.id });

        // Ejecutar reset
        const result = await applyInvestmentReset();
        expect(result.usersProcessed.some((u) => u.userId === investor.id)).toBe(true);
        expect(result.usersProcessed.some((u) => u.userId === normalUser.id)).toBe(false);

        // El usuario normal queda intacto
        const normalUsdAfter = await Account.findOne({ user: normalUser.id, currency: "USD" });
        const normalEurAfter = await Account.findOne({ user: normalUser.id, currency: "EUR" });
        const normalMovementsAfter = await Movement.countDocuments({ user: normalUser.id });

        expect(normalUsdAfter?.balanceCents).toBe(normalUsdBefore?.balanceCents);
        expect(normalEurAfter?.balanceCents).toBe(normalEurBefore?.balanceCents);
        expect(normalMovementsAfter).toBe(normalMovementsBefore);
    });

    it("con saldo recalculado negativo en algún punto, aborta la transacción de ese usuario sin cambios", async () => {
        const user = await createTestUser("Usuario Saldo Negativo");
        await fund(user, "USD", 20_000); // 200,00 USD
        await buy(user, "AAPL", 10_000, "key-reset-neg-buy");

        const usdAcc = await Account.findOne({ user: user.id, currency: "USD" });
        expect(usdAcc).not.toBeNull();

        // Para forzar que la cadena recalculada caiga por debajo de 0 al quitar investment_buy,
        // insertamos un apunte de salida que superaría el saldo restante (por ejemplo payment_out de 300,00 USD)
        await Movement.create({
            user: user.id,
            account: usdAcc!._id,
            currency: "USD",
            type: "payment_out",
            amountCents: 30_000,
            balanceAfterCents: 0,
            merchantKey: "uber",
        });

        // Intentar aplicar el reset
        const result = await applyInvestmentReset();

        // Debe registrar la abortación de ese usuario
        expect(result.usersAborted).toHaveLength(1);
        expect(result.usersAborted[0].userId).toBe(user.id);
        expect(result.usersAborted[0].reason).toContain("Saldo negativo recalculado");

        // Al abortarse la transacción, el usuario debe permanecer SIN CAMBIOS
        // El holding y el trade NO deben haberse borrado
        expect(await Holding.countDocuments({ owner: user.id })).toBe(1);
        expect(await Trade.countDocuments({ owner: user.id })).toBe(1);
        expect(await Movement.countDocuments({ user: user.id, type: "investment_buy" })).toBe(1);

        // El saldo de la cuenta USD sigue con el valor previo sin modificar
        const usdAccCheck = await Account.findOne({ user: user.id, currency: "USD" });
        expect(usdAccCheck?.balanceCents).toBe(usdAcc?.balanceCents);
    });

    it("tras la limpieza, comprar de nuevo funciona con normalidad", async () => {
        const user = await createTestUser("Inversor Reincidente");
        await fund(user, "USD", 60_000); // 600,00 USD
        await buy(user, "AAPL", 20_000, "key-first-buy");

        // Limpiar inversiones
        await applyInvestmentReset();

        // Saldo restaurado a 600,00 USD (60.000 céntimos)
        const usdAcc = await Account.findOne({ user: user.id, currency: "USD" });
        expect(usdAcc?.balanceCents).toBe(60_000);

        // Nueva compra de AAPL por 100,00 USD (10.000 céntimos) a 200,00 USD -> 0.5 unidades
        const newBuy = await buy(user, "AAPL", 10_000, "key-second-buy-post-reset");
        expect(newBuy.status).toBe(201);
        expect(newBuy.body.holding).toEqual({
            symbol: "AAPL",
            unitsE8: 50_000_000,
            investedCents: 10_000,
        });
        expect(newBuy.body.account.balanceCents).toBe(50_000);

        // Verificación de documentos creados tras el nuevo buy
        expect(await Holding.countDocuments({ owner: user.id })).toBe(1);
        expect(await Trade.countDocuments({ owner: user.id })).toBe(1);
        expect(await Movement.countDocuments({ user: user.id, type: "investment_buy" })).toBe(1);

        const newMovement = await Movement.findOne({ user: user.id, type: "investment_buy" });
        expect(newMovement?.balanceAfterCents).toBe(50_000);
    });

    it("reset-investments tras compras y ventas deja el saldo USD correcto y borra ambos tipos de apuntes (sin inflar el saldo)", async () => {
        const user = await createTestUser("Inversor Compras y Ventas");
        await fund(user, "USD", 100_000); // 1.000,00 USD iniciales

        // Compra: 200,00 USD (20.000 céntimos) de AAPL -> Saldo USD: 80.000
        const buyRes = await buy(user, "AAPL", 20_000, "key-reset-buy-sell-1");
        expect(buyRes.status).toBe(201);

        // Venta: 100,00 USD (10.000 céntimos) de AAPL -> Saldo USD: 90.000
        const sellRes = await sell(user, { symbol: "AAPL", amountCents: 10_000 }, "key-reset-buy-sell-2");
        expect(sellRes.status).toBe(201);

        const usdAccBefore = await Account.findOne({ user: user.id, currency: "USD" });
        expect(usdAccBefore?.balanceCents).toBe(90_000);

        // Vista previa
        const preview = await previewInvestmentReset();
        const previewUser = preview.affectedUsers.find((u) => u.userId === user.id);
        expect(previewUser).toBeDefined();
        expect(previewUser?.investmentBuysCount).toBe(1);
        expect(previewUser?.investmentSellsCount).toBe(1);
        expect(previewUser?.currentUsdBalanceCents).toBe(90_000);
        // El saldo proyectado debe ser el original sin inversiones (100.000), NO inflado a 110.000
        expect(previewUser?.projectedUsdBalanceCents).toBe(100_000);

        // Aplicar limpieza
        const result = await applyInvestmentReset();
        const processed = result.usersProcessed.find((u) => u.userId === user.id);
        expect(processed).toBeDefined();
        expect(processed?.investmentBuysDeleted).toBe(1);
        expect(processed?.investmentSellsDeleted).toBe(1);
        expect(processed?.usdBalanceBeforeCents).toBe(90_000);
        expect(processed?.usdBalanceAfterCents).toBe(100_000);

        // Verificación en BD
        expect(await Holding.countDocuments({ owner: user.id })).toBe(0);
        expect(await Trade.countDocuments({ owner: user.id })).toBe(0);
        expect(await Movement.countDocuments({ user: user.id, type: "investment_buy" })).toBe(0);
        expect(await Movement.countDocuments({ user: user.id, type: "investment_sell" })).toBe(0);

        const usdAccAfter = await Account.findOne({ user: user.id, currency: "USD" });
        expect(usdAccAfter?.balanceCents).toBe(100_000);
    });
});
