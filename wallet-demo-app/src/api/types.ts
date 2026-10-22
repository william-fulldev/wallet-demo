// Las fechas llegan como texto ISO desde el JSON, no como Date.
export type User = {
    id: string;
    name: string;
    email: string;
    createdAt: string;
    avatarId: string | null;
};

export const CURRENCIES = ["EUR", "BRL", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export type Account = {
    id: string;
    currency: Currency;
    balanceCents: number;
    updatedAt: string;
};

export type MovementType =
    | "deposit"
    | "exchange_out"
    | "exchange_in"
    | "transfer_out"
    | "transfer_in"
    | "investment_buy"
    | "investment_sell"
    | "payment_out";

// Lo único que se sabe de la otra parte de un envío: nombre y retrato.
export type Counterparty = { name: string; avatarId: string | null };

export type MovementAsset = {
    symbol: string;
    name: string;
};

export type MovementMerchant = {
    key: string;
    name: string;
    category: string;
};

export type Movement = {
    id: string;
    currency: Currency;
    type: MovementType;
    amountCents: number;
    balanceAfterCents: number;
    createdAt: string;
    exchangeId: string | null;
    transferId: string | null;
    counterparty: Counterparty | null;
    note: string | null;
    asset: MovementAsset | null;
    merchant: MovementMerchant | null;
};

export type Contact = { id: string; name: string; avatarId: string | null };

export type TransferResult = {
    transferId: string;
    account: Account;
    movement: Movement;
    recipient: Counterparty;
};

export type MovementsPage = {
    movements: Movement[];
    nextBefore: string | null;
};

export type AccountChange = { account: Account; movement: Movement };

export type ExchangeResult = {
    exchangeId: string;
    sold: AccountChange;
    bought: AccountChange;
    rate: { source: "api" | "fallback"; asOf: string };
};

export type MarketAsset = {
    symbol: string;
    name: string;
    kind: "crypto" | "stock";
    priceCents: number;
    changePct: number | null;
    source: "live" | "cache" | "fallback";
    updatedAt: string;
};

export type Holding = {
    symbol: string;
    name: string;
    unitsE8: number;
    investedCents: number;
    valueCents: number;
    pnlCents: number;
};

export type BuyInvestmentHolding = {
    symbol: string;
    unitsE8: number;
    investedCents: number;
};

export type BuyInvestmentResult = {
    tradeId: string;
    account: Account;
    movement: Movement;
    holding: BuyInvestmentHolding;
};

export type SellInvestmentResult = {
    tradeId: string;
    account: Account;
    movement: Movement;
    holding: BuyInvestmentHolding | null;
    realizedPnlCents: number;
};

export type FeaturesConfig = {
    depositsEnabled: boolean;
};

// Comprueba en ejecución lo que TypeScript solo sabe en compilación.
export function isCurrency(value: unknown): value is Currency {
    return CURRENCIES.some((currency) => currency === value);
}
