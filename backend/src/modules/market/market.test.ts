import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../../app.js";
import { authHeader, createTestUser } from "../../test/helpers.js";
import { ASSET_CATALOG, FALLBACK_QUOTES } from "./market.catalog.js";
import {
    logProviderFailure,
    resetProviderLogThrottle,
    type MarketProvider,
    type Quote,
} from "./market.provider.js";
import {
    clearMarketCache,
    getQuotes,
    listMarketAssets,
    resetMarketProvider,
    setMarketCacheEntryForTest,
    setMarketProvider,
} from "./market.service.js";

function makeMockQuotes(prices: Record<string, number> = {}): Quote[] {
    return ASSET_CATALOG.map((asset) => ({
        symbol: asset.symbol,
        priceCents: prices[asset.symbol] ?? (FALLBACK_QUOTES[asset.symbol]?.priceCents ?? 10_000),
        changePct: 2.5,
        source: "live" as const,
        updatedAt: new Date().toISOString(),
    }));
}

describe("módulo market", () => {
    beforeEach(() => {
        clearMarketCache();
        resetMarketProvider();
        resetProviderLogThrottle();
    });

    afterEach(() => {
        clearMarketCache();
        resetMarketProvider();
        resetProviderLogThrottle();
    });

    it("devuelve cotizaciones en vivo con el proveedor inyectado", async () => {
        const mockProvider: MarketProvider = {
            getQuotes: vi.fn(async () => makeMockQuotes({ BTC: 70_000_00, AAPL: 240_00 })),
        };
        setMarketProvider(mockProvider);

        const quotes = await getQuotes();

        expect(mockProvider.getQuotes).toHaveBeenCalledTimes(1);
        expect(quotes).toHaveLength(ASSET_CATALOG.length);
        const btc = quotes.find((q) => q.symbol === "BTC");
        expect(btc?.priceCents).toBe(70_000_00);
        expect(btc?.source).toBe("live");
    });

    it("la segunda llamada dentro del TTL usa caché sin llamar al proveedor y con source 'live'", async () => {
        const mockProvider: MarketProvider = {
            getQuotes: vi.fn(async () => makeMockQuotes({ BTC: 68_000_00 })),
        };
        setMarketProvider(mockProvider);

        const first = await getQuotes();
        const second = await getQuotes();

        expect(mockProvider.getQuotes).toHaveBeenCalledTimes(1);
        expect(second).toEqual(first);
        for (const q of second) {
            expect(q.source).toBe("live");
        }
    });

    it("criterio de fuente: 'live' dentro del TTL, 'cache' más antigua si el proveedor falla", async () => {
        // Simular que en la caché hay un AAPL obtenido hace 120 segundos (caducado, TTL = 60s)
        const oldFetchedAt = Date.now() - 120_000;
        setMarketCacheEntryForTest("AAPL", {
            symbol: "AAPL",
            priceCents: 22_000,
            changePct: 0.5,
            source: "live",
            updatedAt: new Date(oldFetchedAt).toISOString(),
        }, oldFetchedAt);

        // Proveedor falla al renovar
        const mockProvider: MarketProvider = {
            getQuotes: vi.fn(async () => {
                throw new Error("Timeout del proveedor");
            }),
        };
        setMarketProvider(mockProvider);

        const quotes = await getQuotes();
        const aapl = quotes.find((q) => q.symbol === "AAPL");
        const btc = quotes.find((q) => q.symbol === "BTC");

        // AAPL tenía caché expirada y el proveedor falló -> source: 'cache'
        expect(aapl?.source).toBe("cache");
        expect(aapl?.priceCents).toBe(22_000);

        // BTC no tenía caché y el proveedor falló -> source: 'fallback'
        expect(btc?.source).toBe("fallback");
    });

    it("diagnóstico de proveedor: registra aviso throttled (máx 1 por minuto) y nunca expone la clave", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        const secretKey = "super_secret_finnhub_key_123";
        const messageWithKey = `Fallo en https://finnhub.io/api/v1/quote?token=${secretKey}&symbol=AAPL: 401 Unauthorized`;

        // Primera llamada: debe registrar
        logProviderFailure("finnhub", messageWithKey);
        expect(warnSpy).toHaveBeenCalledTimes(1);

        const loggedText = warnSpy.mock.calls[0]?.[0] as string;
        expect(loggedText).toContain("finnhub");
        expect(loggedText).toContain("401");
        expect(loggedText).not.toContain(secretKey);
        expect(loggedText).toContain("[REDACTED]");

        // Segunda llamada dentro del mismo minuto: ignorada por throttle
        logProviderFailure("finnhub", "Otro error en finnhub");
        expect(warnSpy).toHaveBeenCalledTimes(1);

        // Otro proveedor diferente: sí registra 1 vez
        logProviderFailure("coingecko", "Error 429 Too Many Requests");
        expect(warnSpy).toHaveBeenCalledTimes(2);

        warnSpy.mockRestore();
    });

    it("varias llamadas simultáneas con caché vacía hacen UNA sola llamada al proveedor (single-flight)", async () => {
        const spy = vi.fn(async () => {
            await new Promise((resolve) => setTimeout(resolve, 25));
            return makeMockQuotes();
        });
        const mockProvider: MarketProvider = { getQuotes: spy };
        setMarketProvider(mockProvider);

        const [r1, r2, r3] = await Promise.all([getQuotes(), getQuotes(), getQuotes()]);

        expect(spy).toHaveBeenCalledTimes(1);
        expect(r1).toEqual(r2);
        expect(r2).toEqual(r3);
    });

    it("si un activo falla, los demás siguen en vivo", async () => {
        const allExceptBtc = makeMockQuotes().filter((q) => q.symbol !== "BTC");
        const mockProvider: MarketProvider = {
            getQuotes: vi.fn(async () => allExceptBtc),
        };
        setMarketProvider(mockProvider);

        const quotes = await getQuotes();
        const btc = quotes.find((q) => q.symbol === "BTC");
        const aapl = quotes.find((q) => q.symbol === "AAPL");

        expect(btc).toBeDefined();
        // BTC no vino en vivo y no había caché previa: usa fallback
        expect(btc?.source).toBe("fallback");
        expect(btc?.priceCents).toBe(FALLBACK_QUOTES.BTC.priceCents);

        // AAPL sí vino en vivo
        expect(aapl?.source).toBe("live");
    });

    it("si todo falla y no hay caché, devuelve la reserva con source 'fallback'", async () => {
        const mockProvider: MarketProvider = {
            getQuotes: vi.fn(async () => {
                throw new Error("Red no disponible");
            }),
        };
        setMarketProvider(mockProvider);

        const quotes = await getQuotes();

        expect(quotes).toHaveLength(ASSET_CATALOG.length);
        for (const q of quotes) {
            expect(q.source).toBe("fallback");
            expect(q.priceCents).toBe(FALLBACK_QUOTES[q.symbol].priceCents);
        }
    });

    it("las claves y secretos nunca aparecen en las respuestas de la API", async () => {
        const mockProvider: MarketProvider = {
            getQuotes: vi.fn(async () => makeMockQuotes()),
        };
        setMarketProvider(mockProvider);

        const user = await createTestUser();
        const response = await request(app).get("/api/market/assets").set(authHeader(user));

        expect(response.status).toBe(200);
        const json = JSON.stringify(response.body);

        expect(json).not.toContain("API_KEY");
        expect(json).not.toContain("token");
        expect(json).not.toContain("secret");
        expect(json).not.toContain("key");
    });

    it("GET /api/market/assets exige autenticación y devuelve el catálogo completo", async () => {
        const unauth = await request(app).get("/api/market/assets");
        expect(unauth.status).toBe(401);

        const user = await createTestUser();
        const response = await request(app).get("/api/market/assets").set(authHeader(user));

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body).toHaveLength(ASSET_CATALOG.length);

        const first = response.body[0];
        expect(first).toHaveProperty("symbol");
        expect(first).toHaveProperty("name");
        expect(first).toHaveProperty("kind");
        expect(first).toHaveProperty("priceCents");
        expect(first).toHaveProperty("changePct");
        expect(first).toHaveProperty("source");
        expect(first).toHaveProperty("updatedAt");
    });
});
