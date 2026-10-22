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

function buy(user: TestUser, body: object, key = "idemp-key-buy-01") {
    return request(app)
        .post("/api/investments/buy")
        .set(authHeader(user))
        .set("Idempotency-Key", key)
        .send(body);
}

function sell(user: TestUser, body: object, key?: string) {
    const req = request(app)
        .post("/api/investments/sell")
        .set(authHeader(user));
    if (key !== undefined) {
        req.set("Idempotency-Key", key);
    }
    return req.send(body);
}

describe("POST /api/investments/sell", () => {
    beforeEach(() => {
        clearMarketCache();
        resetMarketProvider();
    });

    afterEach(() => {
        clearMarketCache();
        resetMarketProvider();
    });

    it("venta por importe: acredita exactamente amountCents, descuenta las unidades redondeadas hacia arriba, reduce el coste proporcionalmente y crea el apunte con balanceAfterCents coherente", async () => {
        // AAPL a 200,00 USD (20.000 céntimos)
        setupMockPrices({ AAPL: 20_000 });

        const user = await createTestUser("Vendedor Importe");
        await fund(user, "USD", 50_000); // 500,00 USD

        // Compra de 200,00 USD (20.000 céntimos) -> 1.0 unidad = 100.000.000 unidades E8
        const buyRes = await buy(user, { symbol: "AAPL", amountCents: 20_000 }, "key-buy-sell-test-1");
        expect(buyRes.status).toBe(201);
        expect(buyRes.body.account.balanceCents).toBe(30_000);

        // Vender por importe de 50,00 USD (5.000 céntimos) a precio 200,00 USD (20.000 céntimos)
        // unitsE8 = ceil(5000 * 1e8 / 20000) = 25.000.000 unidades E8
        // Reducción coste: round(20.000 * 25.000.000 / 100.000.000) = 5.000 céntimos
        // realizedPnlCents: 5.000 - 5.000 = 0
        const res = await sell(user, { symbol: "AAPL", amountCents: 5_000 }, "key-sell-amount-1");

        expect(res.status).toBe(201);
        expect(res.body.holding).toEqual({
            symbol: "AAPL",
            unitsE8: 75_000_000,
            investedCents: 15_000,
        });
        expect(res.body.account.balanceCents).toBe(35_000); // 300 + 50 = 350 USD
        expect(res.body.realizedPnlCents).toBe(0);
        expect(res.body.movement.type).toBe("investment_sell");
        expect(res.body.movement.amountCents).toBe(5_000);
        expect(res.body.movement.balanceAfterCents).toBe(35_000);
        expect(res.body.movement.asset).toEqual({ symbol: "AAPL", name: "Apple" });

        // Verificación en BD
        const holding = await Holding.findOne({ owner: user.id, symbol: "AAPL" });
        expect(holding?.unitsE8).toBe(75_000_000);
        expect(holding?.investedCents).toBe(15_000);

        const trade = await Trade.findOne({ owner: user.id, idempotencyKey: "key-sell-amount-1" });
        expect(trade?.side).toBe("sell");
        expect(trade?.amountCents).toBe(5_000);
        expect(trade?.unitsE8).toBe(25_000_000);
        expect(trade?.priceCents).toBe(20_000);

        const movement = await Movement.findOne({ tradeId: trade?._id });
        expect(movement?.type).toBe("investment_sell");
        expect(movement?.amountCents).toBe(5_000);
        expect(movement?.balanceAfterCents).toBe(35_000);
    });

    it("vender todo: la posición desaparece, el dinero recibido es el valor de la posición redondeado, e investedCents queda en 0", async () => {
        setupMockPrices({ AAPL: 20_000 });

        const user = await createTestUser("Vendedor Todo");
        await fund(user, "USD", 50_000);

        // Compra 100,00 USD (10.000 céntimos) de AAPL a 200,00 USD -> 50.000.000 unidades E8
        await buy(user, { symbol: "AAPL", amountCents: 10_000 }, "key-buy-all-1");

        // El precio sube a 250,00 USD (25.000 céntimos)
        setupMockPrices({ AAPL: 25_000 });

        // Vender todo
        // Unidades = 50.000.000. Valor = round(50.000.000 * 25.000 / 1e8) = 12.500 céntimos (125,00 USD)
        // Reducción coste: todo investedCents = 10.000
        // realizedPnlCents = 12.500 - 10.000 = 2.500 (25,00 USD de beneficio)
        const res = await sell(user, { symbol: "AAPL", all: true }, "key-sell-all-1");

        expect(res.status).toBe(201);
        expect(res.body.holding).toBeNull();
        expect(res.body.realizedPnlCents).toBe(2_500);
        expect(res.body.movement.amountCents).toBe(12_500);
        expect(res.body.account.balanceCents).toBe(40_000 + 12_500); // 52.500

        // En BD: el Holding ya no existe
        const holding = await Holding.findOne({ owner: user.id, symbol: "AAPL" });
        expect(holding).toBeNull();
    });

    it("comprar y vender todo al mismo precio no devuelve más de lo invertido", async () => {
        setupMockPrices({ BTC: 6_543_210 }); // precio impar

        const user = await createTestUser("Inversor Mismo Precio");
        await fund(user, "USD", 100_000);

        const buyRes = await buy(user, { symbol: "BTC", amountCents: 33_333 }, "key-buy-odd");
        expect(buyRes.status).toBe(201);

        const sellRes = await sell(user, { symbol: "BTC", all: true }, "key-sell-odd");
        expect(sellRes.status).toBe(201);

        // Dinero recibido nunca puede superar lo invertido a igual precio
        expect(sellRes.body.movement.amountCents).toBeLessThanOrEqual(33_333);
        // Y el saldo final no supera el inicial
        const usdAcc = await Account.findOne({ user: user.id, currency: "USD" });
        expect(usdAcc?.balanceCents).toBeLessThanOrEqual(100_000);
    });

    it("vender más de lo que se tiene, vender sin posición, símbolo desconocido, importes inválidos y cuerpo con amountCents y all a la vez son rechazados sin cambios", async () => {
        setupMockPrices({ AAPL: 20_000 });

        const user = await createTestUser("Casos Invalidos");
        await fund(user, "USD", 50_000);
        await buy(user, { symbol: "AAPL", amountCents: 10_000 }, "key-buy-inv");

        const usdBefore = (await Account.findOne({ user: user.id, currency: "USD" }))?.balanceCents;
        const holdingBefore = await Holding.findOne({ owner: user.id, symbol: "AAPL" });

        // 1. Vender sin posición en MSFT
        const r1 = await sell(user, { symbol: "MSFT", amountCents: 1_000 }, "key-inv-msft");
        expect(r1.status).toBe(422);

        // 2. Vender más de lo que se tiene en AAPL (tiene 50.000.000 unidades, pide 200,00 USD = 100.000.000 unidades)
        const r2 = await sell(user, { symbol: "AAPL", amountCents: 20_000 }, "key-inv-more");
        expect(r2.status).toBe(422);

        // 3. Símbolo desconocido
        const r3 = await sell(user, { symbol: "UNKNOWN_XYZ", amountCents: 1_000 }, "key-inv-unknown");
        expect(r3.status).toBe(422);

        // 4. Importe 0 o negativo o decimal
        const r4 = await sell(user, { symbol: "AAPL", amountCents: 0 }, "key-inv-zero");
        expect(r4.status).toBe(400);

        const r5 = await sell(user, { symbol: "AAPL", amountCents: -500 }, "key-inv-neg");
        expect(r5.status).toBe(400);

        const r6 = await sell(user, { symbol: "AAPL", amountCents: 10.5 }, "key-inv-dec");
        expect(r6.status).toBe(400);

        // 5. amountCents y all a la vez
        const r7 = await sell(user, { symbol: "AAPL", amountCents: 5_000, all: true }, "key-inv-both");
        expect(r7.status).toBe(400);

        // Comprobación de que ningún documento cambió
        const usdAfter = (await Account.findOne({ user: user.id, currency: "USD" }))?.balanceCents;
        const holdingAfter = await Holding.findOne({ owner: user.id, symbol: "AAPL" });
        expect(usdAfter).toBe(usdBefore);
        expect(holdingAfter?.unitsE8).toBe(holdingBefore?.unitsE8);
        expect(holdingAfter?.investedCents).toBe(holdingBefore?.investedCents);
    });

    it("sin autenticación da 401 y sin cabecera Idempotency-Key da 400", async () => {
        const user = await createTestUser("Sin Auth");

        // Sin autenticación
        const unauth = await request(app)
            .post("/api/investments/sell")
            .set("Idempotency-Key", "key-unauth-test")
            .send({ symbol: "AAPL", all: true });
        expect(unauth.status).toBe(401);

        // Sin cabecera Idempotency-Key
        const noKey = await sell(user, { symbol: "AAPL", all: true });
        expect(noKey.status).toBe(400);
    });

    it("repetición con la misma clave: 200 y sin segundo abono. Clave reutilizada con otro importe: 422", async () => {
        setupMockPrices({ AAPL: 20_000 });

        const user = await createTestUser("Idempotencia Sell");
        await fund(user, "USD", 50_000);
        await buy(user, { symbol: "AAPL", amountCents: 20_000 }, "key-buy-idemp-sell");

        // Primera venta
        const res1 = await sell(user, { symbol: "AAPL", amountCents: 5_000 }, "key-sell-idemp-01");
        expect(res1.status).toBe(201);
        expect(res1.body.account.balanceCents).toBe(35_000);

        // Repetición idéntica
        const res2 = await sell(user, { symbol: "AAPL", amountCents: 5_000 }, "key-sell-idemp-01");
        expect(res2.status).toBe(200);
        expect(res2.header["idempotent-replayed"]).toBe("true");
        expect(res2.body.tradeId).toBe(res1.body.tradeId);
        expect(res2.body.account.balanceCents).toBe(35_000); // Sin segundo abono

        // Clave reutilizada con otro importe
        const res3 = await sell(user, { symbol: "AAPL", amountCents: 8_000 }, "key-sell-idemp-01");
        expect(res3.status).toBe(422);

        // Clave reutilizada con all: true
        const res4 = await sell(user, { symbol: "AAPL", all: true }, "key-sell-idemp-01");
        expect(res4.status).toBe(422);
    });

    it("concurrencia: dos ventas simultáneas que juntas superan las unidades dan un 201 y un 422, y el saldo refleja una sola", async () => {
        setupMockPrices({ AAPL: 20_000 });

        const user = await createTestUser("Concurrencia Sell");
        await fund(user, "USD", 50_000);
        // Compra 100,00 USD (10.000 céntimos) -> 50.000.000 unidades
        await buy(user, { symbol: "AAPL", amountCents: 10_000 }, "key-buy-conc");

        // Dos ventas simultáneas de 80,00 USD cada una (40.000.000 unidades cada una, total 80.000.000 > 50.000.000)
        const [p1, p2] = await Promise.all([
            sell(user, { symbol: "AAPL", amountCents: 8_000 }, "key-sell-conc-1"),
            sell(user, { symbol: "AAPL", amountCents: 8_000 }, "key-sell-conc-2"),
        ]);

        const statuses = [p1.status, p2.status].sort();
        expect(statuses).toEqual([201, 422]);

        const usdAcc = await Account.findOne({ user: user.id, currency: "USD" });
        // Saldo inicial 50.000 - 10.000 compra + 8.000 de UNA venta = 48.000
        expect(usdAcc?.balanceCents).toBe(48_000);

        const holding = await Holding.findOne({ owner: user.id, symbol: "AAPL" });
        expect(holding?.unitsE8).toBe(10_000_000);
    });

    it("aislamiento: un usuario no puede vender las unidades de otro", async () => {
        setupMockPrices({ AAPL: 20_000 });

        const userA = await createTestUser("Usuario A");
        const userB = await createTestUser("Usuario B");

        await fund(userA, "USD", 50_000);
        await fund(userB, "USD", 50_000);

        await buy(userA, { symbol: "AAPL", amountCents: 10_000 }, "key-buy-userA");

        // UserB intenta vender AAPL que sólo posee UserA
        const res = await sell(userB, { symbol: "AAPL", amountCents: 5_000 }, "key-sell-userB");
        expect(res.status).toBe(422);

        // Las unidades de UserA no se alteran
        const holdingA = await Holding.findOne({ owner: userA.id, symbol: "AAPL" });
        expect(holdingA?.unitsE8).toBe(50_000_000);
    });

    it("el cliente no puede forzar el precio (campo extra rechazado)", async () => {
        setupMockPrices({ AAPL: 20_000 });

        const user = await createTestUser("Precio Forzado");
        await fund(user, "USD", 50_000);
        await buy(user, { symbol: "AAPL", amountCents: 10_000 }, "key-buy-forced");

        const res = await sell(
            user,
            { symbol: "AAPL", amountCents: 5_000, priceCents: 999_999 },
            "key-sell-forced",
        );
        expect(res.status).toBe(400);
    });
});
