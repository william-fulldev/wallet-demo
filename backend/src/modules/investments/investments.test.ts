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

function setupMockPrices(prices: Record<string, number>) {
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

function buy(user: TestUser, body: object, key = "idemp-key-test-01") {
    return request(app)
        .post("/api/investments/buy")
        .set(authHeader(user))
        .set("Idempotency-Key", key)
        .send(body);
}

describe("módulo investments", () => {
    beforeEach(() => {
        clearMarketCache();
        resetMarketProvider();
    });

    afterEach(() => {
        clearMarketCache();
        resetMarketProvider();
    });

    it("compra: éxito (saldo USD descontado, Holding con las unidades exactas, un apunte investment_buy y un Trade)", async () => {
        // AAPL a 200,00 USD (20.000 céntimos)
        setupMockPrices({ AAPL: 20_000 });

        const user = await createTestUser();
        await fund(user, "USD", 50_000); // 500,00 USD

        // Compra de 100,00 USD (10.000 céntimos) -> 0.5 unidades = 50.000.000 unidades E8
        const res = await buy(user, { symbol: "AAPL", amountCents: 10_000 }, "key-buy-success-01");

        expect(res.status).toBe(201);
        expect(res.body.holding).toEqual({
            symbol: "AAPL",
            unitsE8: 50_000_000,
            investedCents: 10_000,
        });
        expect(res.body.account.balanceCents).toBe(40_000); // 500 - 100 = 400 USD
        expect(res.body.movement.type).toBe("investment_buy");
        expect(res.body.movement.asset).toEqual({ symbol: "AAPL", name: "Apple" });

        // Verificación en base de datos
        const trade = await Trade.findOne({ owner: user.id, idempotencyKey: "key-buy-success-01" });
        expect(trade).not.toBeNull();
        expect(trade?.unitsE8).toBe(50_000_000);
        expect(trade?.priceCents).toBe(20_000);

        const holding = await Holding.findOne({ owner: user.id, symbol: "AAPL" });
        expect(holding?.unitsE8).toBe(50_000_000);
        expect(holding?.investedCents).toBe(10_000);

        const movement = await Movement.findOne({ user: user.id, type: "investment_buy" });
        expect(movement?.amountCents).toBe(10_000);
        expect(movement?.balanceAfterCents).toBe(40_000);
        expect(movement?.asset).toMatchObject({ symbol: "AAPL", name: "Apple" });
    });

    it("cálculo exacto de unitsE8 con un precio conocido", async () => {
        // BTC a 65.000,00 USD (6.500.000 céntimos)
        setupMockPrices({ BTC: 6_500_000 });

        const user = await createTestUser();
        await fund(user, "USD", 100_000); // 1.000,00 USD

        // Inversión de 130,00 USD (13.000 céntimos)
        // unitsE8 = Math.floor(13000 * 1e8 / 6500000) = 200.000
        const res = await buy(user, { symbol: "BTC", amountCents: 13_000 }, "key-btc-calc");

        expect(res.status).toBe(201);
        expect(res.body.holding.unitsE8).toBe(200_000);
    });

    it("segunda compra del mismo símbolo acumula en el mismo Holding", async () => {
        setupMockPrices({ AAPL: 20_000 });

        const user = await createTestUser();
        await fund(user, "USD", 50_000);

        await buy(user, { symbol: "AAPL", amountCents: 10_000 }, "key-acc-1");
        const res2 = await buy(user, { symbol: "AAPL", amountCents: 20_000 }, "key-acc-2");

        expect(res2.status).toBe(201);
        expect(res2.body.holding.unitsE8).toBe(150_000_000); // 0.5 + 1.0 = 1.5 unidades
        expect(res2.body.holding.investedCents).toBe(30_000);

        const holdingsCount = await Holding.countDocuments({ owner: user.id, symbol: "AAPL" });
        expect(holdingsCount).toBe(1);
    });

    it("saldo insuficiente da 422 con mensaje claro y sin cambios en ningún documento", async () => {
        setupMockPrices({ AAPL: 20_000 });

        const user = await createTestUser();
        await fund(user, "USD", 2_000); // Solo 20,00 USD

        const res = await buy(user, { symbol: "AAPL", amountCents: 10_000 }, "key-insufficient");

        expect(res.status).toBe(422);
        expect(res.body.message).toContain("Saldo insuficiente en USD");

        // Sin cambios en la base de datos
        const usdAcc = await Account.findOne({ user: user.id, currency: "USD" });
        expect(usdAcc?.balanceCents).toBe(2_000);

        expect(await Trade.countDocuments({ owner: user.id })).toBe(0);
        expect(await Holding.countDocuments({ owner: user.id })).toBe(0);
        expect(await Movement.countDocuments({ user: user.id, type: "investment_buy" })).toBe(0);
    });

    it("símbolo desconocido da 422", async () => {
        const user = await createTestUser();
        await fund(user, "USD", 20_000);

        const res = await buy(user, { symbol: "DESCONOCIDO", amountCents: 5_000 });
        expect(res.status).toBe(422);
    });

    it("importe 0, negativo, decimal o enorme es rechazado con 400", async () => {
        const user = await createTestUser();
        await fund(user, "USD", 50_000);

        const zero = await buy(user, { symbol: "AAPL", amountCents: 0 }, "key-0");
        expect(zero.status).toBe(400);

        const negative = await buy(user, { symbol: "AAPL", amountCents: -500 }, "key-neg");
        expect(negative.status).toBe(400);

        const decimal = await buy(user, { symbol: "AAPL", amountCents: 12.34 }, "key-dec");
        expect(decimal.status).toBe(400);

        const huge = await buy(user, { symbol: "AAPL", amountCents: 10_000_000_000 }, "key-huge");
        expect(huge.status).toBe(400);
    });

    it("sin autenticación responde 401", async () => {
        const res = await request(app)
            .post("/api/investments/buy")
            .set("Idempotency-Key", "key-unauth-12345")
            .send({ symbol: "AAPL", amountCents: 1_000 });

        expect(res.status).toBe(401);
    });

    it("sin cabecera Idempotency-Key responde 400", async () => {
        const user = await createTestUser();
        const res = await request(app)
            .post("/api/investments/buy")
            .set(authHeader(user))
            .send({ symbol: "AAPL", amountCents: 1_000 });

        expect(res.status).toBe(400);
        expect(res.body.message).toContain("Idempotency-Key");
    });

    it("repetición con la misma clave responde 200 con cabecera Idempotent-Replayed y sin segundo débito", async () => {
        setupMockPrices({ AAPL: 20_000 });

        const user = await createTestUser();
        await fund(user, "USD", 50_000);

        const res1 = await buy(user, { symbol: "AAPL", amountCents: 10_000 }, "key-replay-same");
        expect(res1.status).toBe(201);
        expect(res1.headers["idempotent-replayed"]).toBeUndefined();

        const res2 = await buy(user, { symbol: "AAPL", amountCents: 10_000 }, "key-replay-same");
        expect(res2.status).toBe(200);
        expect(res2.headers["idempotent-replayed"]).toBe("true");

        // Saldo solo se descontó una vez
        const usdAcc = await Account.findOne({ user: user.id, currency: "USD" });
        expect(usdAcc?.balanceCents).toBe(40_000);
        expect(await Trade.countDocuments({ owner: user.id })).toBe(1);
    });

    it("clave reutilizada con otro importe o símbolo responde 422", async () => {
        setupMockPrices({ AAPL: 20_000 });

        const user = await createTestUser();
        await fund(user, "USD", 50_000);

        await buy(user, { symbol: "AAPL", amountCents: 10_000 }, "key-reused-conflict");
        const res = await buy(user, { symbol: "AAPL", amountCents: 20_000 }, "key-reused-conflict");

        expect(res.status).toBe(422);
        expect(res.body.message).toContain("idempotencia");
    });

    it("concurrencia: dos compras simultáneas de 60,00 con 100,00 USD dan un 201 y un 422 y el saldo queda en 40,00", async () => {
        setupMockPrices({ AAPL: 20_000 });

        const user = await createTestUser();
        await fund(user, "USD", 10_000); // 100,00 USD

        const results = await Promise.all([
            buy(user, { symbol: "AAPL", amountCents: 6_000 }, "key-race-1"),
            buy(user, { symbol: "AAPL", amountCents: 6_000 }, "key-race-2"),
        ]);

        const statuses = results.map((r) => r.status).sort((a, b) => a - b);
        expect(statuses).toEqual([201, 422]);

        const usdAcc = await Account.findOne({ user: user.id, currency: "USD" });
        expect(usdAcc?.balanceCents).toBe(4_000); // 100 - 60 = 40 USD
    });

    it("el cliente no puede forzar el precio (un campo priceCents extra en el cuerpo se rechaza)", async () => {
        const user = await createTestUser();
        await fund(user, "USD", 50_000);

        const res = await buy(
            user,
            { symbol: "AAPL", amountCents: 10_000, priceCents: 1 },
            "key-extra-price",
        );

        expect(res.status).toBe(400);
    });

    it("GET /api/investments: valor y pnlCents correctos con un precio conocido", async () => {
        // AAPL comprado a 200,00 USD
        setupMockPrices({ AAPL: 20_000 });

        const user = await createTestUser();
        await fund(user, "USD", 50_000);

        // Compra 100,00 USD -> 50.000.000 unidades E8 (0.5 acciones)
        await buy(user, { symbol: "AAPL", amountCents: 10_000 }, "key-inv-pnl");

        // El precio sube a 250,00 USD (25.000 céntimos)
        clearMarketCache();
        setupMockPrices({ AAPL: 25_000 });

        const res = await request(app).get("/api/investments").set(authHeader(user));

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toHaveLength(1);

        const aapl = res.body[0];
        expect(aapl.symbol).toBe("AAPL");
        expect(aapl.name).toBe("Apple");
        expect(aapl.unitsE8).toBe(50_000_000);
        expect(aapl.investedCents).toBe(10_000);
        // valueCents = Math.round(50_000_000 * 25_000 / 1e8) = 12_500 céntimos (125,00 USD)
        expect(aapl.valueCents).toBe(12_500);
        // pnlCents = 12_500 - 10_000 = +2_500 céntimos (+25,00 USD)
        expect(aapl.pnlCents).toBe(2_500);
    });

    it("comprar 110,00 USD de un activo a 190,00 US$ y valorarlo al mismo precio da ganancia 0", async () => {
        // AAPL a 190,00 USD
        setupMockPrices({ AAPL: 19_000 });

        const user = await createTestUser();
        await fund(user, "USD", 50_000);

        // Compra 110,00 USD (11.000 céntimos)
        await buy(user, { symbol: "AAPL", amountCents: 11_000 }, "key-inv-round-zero");

        const res = await request(app).get("/api/investments").set(authHeader(user));

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);

        const aapl = res.body[0];
        expect(aapl.investedCents).toBe(11_000);
        expect(aapl.valueCents).toBe(11_000);
        expect(aapl.pnlCents).toBe(0);
    });
});
