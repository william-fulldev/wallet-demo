export type AssetKind = "crypto" | "stock";
export type AssetProviderKind = "coingecko" | "finnhub";

export type AssetDefinition = {
    symbol: string;
    name: string;
    kind: AssetKind;
    provider: AssetProviderKind;
    coingeckoId?: string;
};

// Catálogo fijo de activos admitidos para mercado e inversiones (todo en USD).
export const ASSET_CATALOG: readonly AssetDefinition[] = [
    { symbol: "BTC", name: "Bitcoin", kind: "crypto", provider: "coingecko", coingeckoId: "bitcoin" },
    { symbol: "AAPL", name: "Apple", kind: "stock", provider: "finnhub" },
    { symbol: "GOOGL", name: "Alphabet", kind: "stock", provider: "finnhub" },
    { symbol: "AMZN", name: "Amazon", kind: "stock", provider: "finnhub" },
    { symbol: "MSFT", name: "Microsoft", kind: "stock", provider: "finnhub" },
    { symbol: "TSLA", name: "Tesla", kind: "stock", provider: "finnhub" },
] as const;

const ASSETS_BY_SYMBOL = new Map<string, AssetDefinition>(
    ASSET_CATALOG.map((asset) => [asset.symbol.toUpperCase(), asset]),
);

export function getAssetDefinition(symbol: string): AssetDefinition | null {
    return ASSETS_BY_SYMBOL.get(symbol.trim().toUpperCase()) ?? null;
}

// Instantánea de reserva fijada el 22 de octubre de 2026 a partir de cotizaciones en vivo.
// Sirve únicamente como último recurso cuando el proveedor falla y no existe caché previa.
export const FALLBACK_QUOTES: Record<string, { priceCents: number; changePct: number }> = {
    BTC: { priceCents: 8_427_200, changePct: 1.67 }, // 84.272,00 USD
    AAPL: { priceCents: 34_400, changePct: 1.32 },   // 344,00 USD
    GOOGL: { priceCents: 33_500, changePct: -1.62 }, // 335,00 USD
    AMZN: { priceCents: 26_200, changePct: -0.10 },  // 262,00 USD
    MSFT: { priceCents: 53_300, changePct: 0.20 },   // 533,00 USD
    TSLA: { priceCents: 38_600, changePct: 3.41 },   // 386,00 USD
};
