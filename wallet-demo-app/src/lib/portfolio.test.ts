import { describe, expect, it } from "vitest";
import type { Holding } from "../api/types";
import { summarizePortfolio } from "./portfolio";

function makeHolding(overrides: Partial<Holding>): Holding {
    return {
        symbol: "BTC",
        name: "Bitcoin",
        unitsE8: 100_000_000,
        investedCents: 10_000,
        valueCents: 10_000,
        pnlCents: 0,
        ...overrides,
    };
}

describe("summarizePortfolio", () => {
    it("devuelve valores en cero y porcentaje null para cartera vacía", () => {
        const summary = summarizePortfolio([]);
        expect(summary).toEqual({
            totalValueCents: 0,
            totalInvestedCents: 0,
            totalPnlCents: 0,
            pnlPct: null,
        });
    });

    it("calcula correctamente una sola posición con ganancia", () => {
        const holdings: Holding[] = [
            makeHolding({
                symbol: "BTC",
                investedCents: 10_000,
                valueCents: 12_500,
                pnlCents: 2_500,
            }),
        ];

        const summary = summarizePortfolio(holdings);
        expect(summary.totalInvestedCents).toBe(10_000);
        expect(summary.totalValueCents).toBe(12_500);
        expect(summary.totalPnlCents).toBe(2_500);
        expect(summary.pnlPct).toBe(25.0);
    });

    it("calcula correctamente varias posiciones con ganancia y pérdida mezcladas", () => {
        const holdings: Holding[] = [
            makeHolding({
                symbol: "AAPL",
                investedCents: 10_000,
                valueCents: 12_000,
                pnlCents: 2_000,
            }),
            makeHolding({
                symbol: "TSLA",
                investedCents: 5_000,
                valueCents: 4_000,
                pnlCents: -1_000,
            }),
        ];

        const summary = summarizePortfolio(holdings);
        expect(summary.totalInvestedCents).toBe(15_000);
        expect(summary.totalValueCents).toBe(16_000);
        expect(summary.totalPnlCents).toBe(1_000);
        // (1.000 / 15.000) * 100 = 6.6666... -> 6.67
        expect(summary.pnlPct).toBe(6.67);
    });

    it("devuelve pnlPct null cuando el total invertido es cero", () => {
        const holdings: Holding[] = [
            makeHolding({
                symbol: "BTC",
                investedCents: 0,
                valueCents: 1_000,
                pnlCents: 1_000,
            }),
        ];

        const summary = summarizePortfolio(holdings);
        expect(summary.totalInvestedCents).toBe(0);
        expect(summary.totalValueCents).toBe(1_000);
        expect(summary.totalPnlCents).toBe(1_000);
        expect(summary.pnlPct).toBeNull();
    });

    it("calcula una pérdida neta global con porcentaje negativo", () => {
        const holdings: Holding[] = [
            makeHolding({
                symbol: "GOOGL",
                investedCents: 20_000,
                valueCents: 18_000,
                pnlCents: -2_000,
            }),
        ];

        const summary = summarizePortfolio(holdings);
        expect(summary.totalInvestedCents).toBe(20_000);
        expect(summary.totalValueCents).toBe(18_000);
        expect(summary.totalPnlCents).toBe(-2_000);
        expect(summary.pnlPct).toBe(-10.0);
    });
});
