import type { Holding } from "../api/types";

export type PortfolioSummary = {
    totalValueCents: number;
    totalInvestedCents: number;
    totalPnlCents: number;
    pnlPct: number | null;
};

/**
 * Calcula el resumen acumulado de una cartera de inversiones a partir de sus posiciones.
 * Utiliza aritmética entera para los importes en céntimos.
 * Si el total invertido es 0, pnlPct es null.
 */
export function summarizePortfolio(holdings: Holding[]): PortfolioSummary {
    if (!holdings || holdings.length === 0) {
        return {
            totalValueCents: 0,
            totalInvestedCents: 0,
            totalPnlCents: 0,
            pnlPct: null,
        };
    }

    let totalValueCents = 0;
    let totalInvestedCents = 0;

    for (const holding of holdings) {
        totalValueCents += holding.valueCents;
        totalInvestedCents += holding.investedCents;
    }

    const totalPnlCents = totalValueCents - totalInvestedCents;

    const pnlPct =
        totalInvestedCents > 0
            ? Number(((totalPnlCents / totalInvestedCents) * 100).toFixed(2))
            : null;

    return {
        totalValueCents,
        totalInvestedCents,
        totalPnlCents,
        pnlPct,
    };
}
