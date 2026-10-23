import { describe, expect, it } from "vitest";
import { toPublicMovement } from "./accounts.service.js";

describe("toPublicMovement", () => {
    it("expone merchant y asset correctamente, y nunca datos internos", () => {
        const rawMovement = {
            id: "67167a80b8529369911e3890",
            currency: "USD",
            type: "investment_buy",
            amountCents: 10_000,
            balanceAfterCents: 40_000,
            createdAt: new Date("2026-10-22T00:00:00.000Z"),
            asset: { symbol: "AAPL", name: "Apple" },
            merchantKey: undefined,
            // Campos internos que nunca deben exponerse
            tradeId: "67167a80b8529369911e3891",
            user: "67167a80b8529369911e3892",
            account: "67167a80b8529369911e3893",
        };

        const result = toPublicMovement(rawMovement);

        expect(result.asset).toEqual({ symbol: "AAPL", name: "Apple" });
        expect(result.merchant).toBeNull();
        expect((result as Record<string, unknown>).user).toBeUndefined();
        expect((result as Record<string, unknown>).account).toBeUndefined();
        expect((result as Record<string, unknown>).tradeId).toBeUndefined();
        expect((result as Record<string, unknown>).merchantKey).toBeUndefined();
    });

    it("resuelve merchant con el catálogo de comercios a partir de merchantKey", () => {
        const rawMovement = {
            id: "67167a80b8529369911e3894",
            currency: "EUR",
            type: "payment_out",
            amountCents: 1299,
            balanceAfterCents: 48701,
            createdAt: new Date("2026-10-22T00:01:00.000Z"),
            merchantKey: "netflix",
            asset: undefined,
        };

        const result = toPublicMovement(rawMovement);

        expect(result.merchant).toEqual({
            key: "netflix",
            name: "Netflix",
            category: "Suscripciones",
        });
        expect(result.asset).toBeNull();
    });

    it("resuelve McDonald's correctamente a partir de merchantKey mcdonalds y alias", () => {
        const rawMovement = {
            id: "67167a80b8529369911e3899",
            currency: "EUR",
            type: "payment_out",
            amountCents: 950,
            balanceAfterCents: 49050,
            createdAt: new Date("2026-10-22T00:01:30.000Z"),
            merchantKey: "mcdonalds",
            asset: undefined,
        };

        const result = toPublicMovement(rawMovement);

        expect(result.merchant).toEqual({
            key: "mcdonalds",
            name: "McDonald's",
            category: "Restauración",
        });

        // Verificamos alias macdonal
        const aliasResult = toPublicMovement({ ...rawMovement, merchantKey: "macdonal" });
        expect(aliasResult.merchant?.name).toBe("McDonald's");
    });

    it("expone asset correctamente en un apunte de tipo investment_sell", () => {
        const rawMovement = {
            id: "67167a80b8529369911e3895",
            currency: "USD",
            type: "investment_sell",
            amountCents: 5_000,
            balanceAfterCents: 45_000,
            createdAt: new Date("2026-10-22T00:02:00.000Z"),
            asset: { symbol: "BTC", name: "Bitcoin" },
            tradeId: "67167a80b8529369911e3896",
        };

        const result = toPublicMovement(rawMovement);

        expect(result.type).toBe("investment_sell");
        expect(result.asset).toEqual({ symbol: "BTC", name: "Bitcoin" });
        expect(result.amountCents).toBe(5_000);
        expect(result.balanceAfterCents).toBe(45_000);
    });
});
