import { apiRequest } from "./client";
import type { BuyInvestmentResult, Holding, MarketAsset, SellInvestmentResult } from "./types";

export type BuyInvestmentInput = {
    symbol: string;
    amountCents: number;
    idempotencyKey: string;
};

export type SellInvestmentInput =
    | { symbol: string; amountCents: number; idempotencyKey: string }
    | { symbol: string; all: true; idempotencyKey: string };

export function fetchMarketAssets(): Promise<MarketAsset[]> {
    return apiRequest<MarketAsset[]>("/api/market/assets");
}

export function fetchInvestments(): Promise<Holding[]> {
    return apiRequest<Holding[]>("/api/investments");
}

export function buyInvestment({ idempotencyKey, ...body }: BuyInvestmentInput): Promise<BuyInvestmentResult> {
    return apiRequest<BuyInvestmentResult>("/api/investments/buy", {
        method: "POST",
        body,
        headers: { "Idempotency-Key": idempotencyKey },
    });
}

export function sellInvestment({ idempotencyKey, ...body }: SellInvestmentInput): Promise<SellInvestmentResult> {
    return apiRequest<SellInvestmentResult>("/api/investments/sell", {
        method: "POST",
        body,
        headers: { "Idempotency-Key": idempotencyKey },
    });
}

