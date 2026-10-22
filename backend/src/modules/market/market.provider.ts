import { env } from "../../config/env.js";
import { ASSET_CATALOG, type AssetDefinition } from "./market.catalog.js";

const REQUEST_TIMEOUT_MS = 5_000;

export type QuoteSource = "live" | "cache" | "fallback";

export type Quote = {
    symbol: string;
    priceCents: number;
    changePct: number | null;
    source: QuoteSource;
    updatedAt: string;
};

export interface MarketProvider {
    getQuotes(): Promise<Quote[]>;
}

// Control de registro para limitar a máximo un aviso por proveedor cada minuto
const lastLogByProvider = new Map<string, number>();
const LOG_THROTTLE_MS = 60_000;

export function resetProviderLogThrottle(): void {
    lastLogByProvider.clear();
}

export function logProviderFailure(provider: string, reason: string): void {
    const now = Date.now();
    const last = lastLogByProvider.get(provider) ?? 0;
    if (now - last < LOG_THROTTLE_MS) {
        return;
    }
    lastLogByProvider.set(provider, now);

    // Sanitiza cualquier clave o token de la URL o mensaje
    const sanitizedReason = reason
        .replace(/(?:key|token|api[_-]?key)=[^&\s]+/gi, "$1=[REDACTED]")
        .replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]");

    console.warn(`[Aviso proveedor ${provider}]: ${sanitizedReason}`);
}

async function fetchCoinGeckoQuote(asset: AssetDefinition, apiKey: string): Promise<Quote | null> {
    const id = asset.coingeckoId ?? "bitcoin";
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true`;

    const response = await fetch(url, {
        headers: { "x-cg-demo-api-key": apiKey },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
        throw new Error(`CoinGecko respondió con código ${response.status}`);
    }

    const data = (await response.json()) as Record<string, { usd?: number; usd_24h_change?: number }>;
    const coinData = data[id];

    if (!coinData || typeof coinData.usd !== "number" || coinData.usd <= 0) {
        throw new Error("Respuesta inválida de CoinGecko");
    }

    const priceCents = Math.round(coinData.usd * 100);
    const changePct =
        typeof coinData.usd_24h_change === "number" ? Number(coinData.usd_24h_change.toFixed(2)) : null;

    return {
        symbol: asset.symbol,
        priceCents,
        changePct,
        source: "live",
        updatedAt: new Date().toISOString(),
    };
}

async function fetchFinnhubQuote(asset: AssetDefinition, apiKey: string): Promise<Quote | null> {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(asset.symbol)}`;

    const response = await fetch(url, {
        headers: { "X-Finnhub-Token": apiKey },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
        throw new Error(`Finnhub respondió con código ${response.status}`);
    }

    const data = (await response.json()) as { c?: number; dp?: number };

    if (typeof data.c !== "number" || data.c <= 0) {
        throw new Error(`Respuesta inválida de Finnhub para ${asset.symbol}`);
    }

    const priceCents = Math.round(data.c * 100);
    const changePct = typeof data.dp === "number" ? Number(data.dp.toFixed(2)) : null;

    return {
        symbol: asset.symbol,
        priceCents,
        changePct,
        source: "live",
        updatedAt: new Date().toISOString(),
    };
}

export class LiveMarketProvider implements MarketProvider {
    async getQuotes(): Promise<Quote[]> {
        const promises = ASSET_CATALOG.map(async (asset): Promise<Quote | null> => {
            try {
                if (asset.provider === "coingecko") {
                    if (!env.COINGECKO_DEMO_API_KEY) {
                        return null;
                    }
                    return await fetchCoinGeckoQuote(asset, env.COINGECKO_DEMO_API_KEY);
                }

                if (asset.provider === "finnhub") {
                    if (!env.FINNHUB_API_KEY) {
                        return null;
                    }
                    return await fetchFinnhubQuote(asset, env.FINNHUB_API_KEY);
                }

                return null;
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                logProviderFailure(asset.provider, msg);
                return null;
            }
        });

        const results = await Promise.allSettled(promises);
        const quotes: Quote[] = [];

        for (const res of results) {
            if (res.status === "fulfilled" && res.value !== null) {
                quotes.push(res.value);
            }
        }

        return quotes;
    }
}
