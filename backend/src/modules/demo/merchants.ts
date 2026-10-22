// Catálogo fijo de comercios de ejemplo para gastos simulados.
export type Merchant = {
    key: string;
    name: string;
    category: string;
    defaultAmountCents: number;
};

export const MERCHANTS: readonly Merchant[] = [
    { key: "netflix", name: "Netflix", category: "Suscripciones", defaultAmountCents: 1299 },
    { key: "spotify", name: "Spotify", category: "Suscripciones", defaultAmountCents: 1099 },
    { key: "starbucks", name: "Starbucks", category: "Cafeterías", defaultAmountCents: 485 },
    { key: "zara", name: "Zara", category: "Ropa", defaultAmountCents: 4995 },
    { key: "amazon", name: "Amazon", category: "Compras", defaultAmountCents: 2740 },
    { key: "uber", name: "Uber", category: "Transporte", defaultAmountCents: 830 },
    { key: "apple", name: "Apple", category: "Servicios", defaultAmountCents: 299 },
] as const;

export type PublicMerchant = {
    key: string;
    name: string;
    category: string;
};

const MERCHANTS_BY_KEY = new Map<string, PublicMerchant>(
    MERCHANTS.map((m) => [m.key, { key: m.key, name: m.name, category: m.category }]),
);

export function getMerchant(key: string): PublicMerchant | null {
    return MERCHANTS_BY_KEY.get(key) ?? null;
}
