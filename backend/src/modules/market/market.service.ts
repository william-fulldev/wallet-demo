import { env } from "../../config/env.js";
import {
    ASSET_CATALOG,
    FALLBACK_QUOTES,
    getAssetDefinition,
    type AssetKind,
} from "./market.catalog.js";
import {
    LiveMarketProvider,
    logProviderFailure,
    type MarketProvider,
    type Quote,
    type QuoteSource,
} from "./market.provider.js";

export type MarketAsset = {
    symbol: string;
    name: string;
    kind: AssetKind;
    priceCents: number;
    changePct: number | null;
    source: QuoteSource;
    updatedAt: string;
};

type CacheEntry = {
    quote: Quote;
    fetchedAt: number;
};

const cache = new Map<string, CacheEntry>();
let inFlightRequest: Promise<Quote[]> | null = null;
let currentProvider: MarketProvider = new LiveMarketProvider();

export function setMarketProvider(provider: MarketProvider): void {
    currentProvider = provider;
}

export function resetMarketProvider(): void {
    currentProvider = new LiveMarketProvider();
}

export function clearMarketCache(): void {
    cache.clear();
    inFlightRequest = null;
}

export function setMarketCacheEntryForTest(symbol: string, quote: Quote, fetchedAt: number): void {
    cache.set(symbol, { quote, fetchedAt });
}

async function fetchFromProvider(): Promise<Quote[]> {
    const now = Date.now();
    const ttlMs = env.MARKET_CACHE_TTL_SECONDS * 1000;
    let providerQuotes: Quote[] = [];

    try {
        providerQuotes = await currentProvider.getQuotes();
    } catch (error) {
        logProviderFailure(
            "market_provider",
            error instanceof Error ? error.message : String(error),
        );
        providerQuotes = [];
    }

    const bySymbol = new Map<string, Quote>(
        providerQuotes.map((q) => [q.symbol.toUpperCase(), q]),
    );

    const result: Quote[] = [];

    for (const asset of ASSET_CATALOG) {
        const live = bySymbol.get(asset.symbol);

        if (live && live.priceCents > 0) {
            const liveQuote: Quote = {
                ...live,
                symbol: asset.symbol,
                source: "live",
            };
            cache.set(asset.symbol, { quote: liveQuote, fetchedAt: now });
            result.push(liveQuote);
        } else {
            const cached = cache.get(asset.symbol);
            if (cached) {
                // "live" = obtenida del proveedor dentro de la ventana de vida (TTL), aunque se sirva desde memoria;
                // "cache" = más antigua que el TTL y servida porque el proveedor falló.
                const isWithinTtl = now - cached.fetchedAt < ttlMs;
                result.push({
                    ...cached.quote,
                    source: isWithinTtl ? "live" : "cache",
                });
            } else {
                // Reserva fija cuando nunca ha habido cotización previa.
                const fallback = FALLBACK_QUOTES[asset.symbol] ?? {
                    priceCents: 10_000,
                    changePct: 0,
                };
                result.push({
                    symbol: asset.symbol,
                    priceCents: fallback.priceCents,
                    changePct: fallback.changePct,
                    source: "fallback",
                    updatedAt: new Date(now).toISOString(),
                });
            }
        }
    }

    return result;
}

export async function getQuotes(): Promise<Quote[]> {
    const now = Date.now();
    const ttlMs = env.MARKET_CACHE_TTL_SECONDS * 1000;

    // Si todos los activos están en caché y ninguno ha caducado, se sirven de memoria sin llamar al proveedor.
    // "live" = obtenida del proveedor dentro de la ventana de vida (TTL), aunque se sirva desde memoria.
    const allFresh = ASSET_CATALOG.every((asset) => {
        const entry = cache.get(asset.symbol);
        return entry !== undefined && now - entry.fetchedAt < ttlMs;
    });

    if (allFresh) {
        return ASSET_CATALOG.map((asset) => ({
            ...cache.get(asset.symbol)!.quote,
            source: "live" as const,
        }));
    }

    // Petición compartida en vuelo (single-flight)
    if (inFlightRequest) {
        return await inFlightRequest;
    }

    inFlightRequest = (async () => {
        try {
            return await fetchFromProvider();
        } finally {
            inFlightRequest = null;
        }
    })();

    return await inFlightRequest;
}

export async function getAssetQuote(symbol: string): Promise<Quote> {
    const assetDef = getAssetDefinition(symbol);
    if (!assetDef) {
        throw new Error(`Activo no reconocido: ${symbol}`);
    }

    const quotes = await getQuotes();
    const quote = quotes.find((q) => q.symbol === assetDef.symbol);

    if (!quote) {
        throw new Error(`No hay cotización disponible para ${symbol}`);
    }

    return quote;
}

export async function listMarketAssets(): Promise<MarketAsset[]> {
    const quotes = await getQuotes();
    const bySymbol = new Map(quotes.map((q) => [q.symbol, q]));

    return ASSET_CATALOG.map((asset) => {
        const quote = bySymbol.get(asset.symbol);
        return {
            symbol: asset.symbol,
            name: asset.name,
            kind: asset.kind,
            priceCents: quote ? quote.priceCents : FALLBACK_QUOTES[asset.symbol]?.priceCents ?? 10_000,
            changePct: quote ? quote.changePct : FALLBACK_QUOTES[asset.symbol]?.changePct ?? null,
            source: quote ? quote.source : "fallback",
            updatedAt: quote ? quote.updatedAt : new Date().toISOString(),
        };
    });
}
