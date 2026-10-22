import { describe, expect, it } from "vitest";
import type { Movement } from "../api/types";
import { movementSign, movementTitle } from "./movements";

function makeMovement(overrides: Partial<Movement>): Movement {
    return {
        id: "m1",
        currency: "EUR",
        type: "deposit",
        amountCents: 100,
        balanceAfterCents: 100,
        createdAt: "2026-10-21T10:00:00.000Z",
        exchangeId: null,
        transferId: null,
        counterparty: null,
        note: null,
        asset: null,
        merchant: null,
        ...overrides,
    };
}

describe("movementSign", () => {
    it("resta en las salidas y compras y suma en las entradas", () => {
        expect(movementSign("transfer_out")).toBe(-1);
        expect(movementSign("exchange_out")).toBe(-1);
        expect(movementSign("payment_out")).toBe(-1);
        expect(movementSign("investment_buy")).toBe(-1);
        expect(movementSign("transfer_in")).toBe(1);
        expect(movementSign("exchange_in")).toBe(1);
        expect(movementSign("deposit")).toBe(1);
        expect(movementSign("investment_sell")).toBe(1);
    });
});

describe("movementTitle", () => {
    const ana = { name: "Ana", avatarId: null };

    it("nombra a la otra parte en los envíos", () => {
        expect(movementTitle(makeMovement({ type: "transfer_out", counterparty: ana }))).toBe("Enviado a Ana");
        expect(movementTitle(makeMovement({ type: "transfer_in", counterparty: ana }))).toBe("Recibido de Ana");
    });

    it("usa un texto genérico si la otra cuenta ya no existe", () => {
        expect(movementTitle(makeMovement({ type: "transfer_out" }))).toBe("Envío");
        expect(movementTitle(makeMovement({ type: "transfer_in" }))).toBe("Dinero recibido");
    });

    it("nombra al comercio en payment_out o usa el respaldo", () => {
        expect(
            movementTitle(
                makeMovement({
                    type: "payment_out",
                    merchant: { key: "netflix", name: "Netflix", category: "Suscripciones" },
                }),
            ),
        ).toBe("Netflix");

        expect(movementTitle(makeMovement({ type: "payment_out", merchant: null }))).toBe("Pago");
    });

    it("nombra al activo en investment_buy o usa el respaldo", () => {
        expect(
            movementTitle(
                makeMovement({
                    type: "investment_buy",
                    asset: { symbol: "BTC", name: "Bitcoin" },
                }),
            ),
        ).toBe("Compra de Bitcoin");

        expect(
            movementTitle(
                makeMovement({
                    type: "investment_buy",
                    asset: { symbol: "AAPL", name: "Apple" },
                }),
            ),
        ).toBe("Compra de Apple");

        expect(movementTitle(makeMovement({ type: "investment_buy", asset: null }))).toBe("Compra de inversión");
    });

    it("nombra al activo en investment_sell o usa el respaldo", () => {
        expect(
            movementTitle(
                makeMovement({
                    type: "investment_sell",
                    asset: { symbol: "BTC", name: "Bitcoin" },
                }),
            ),
        ).toBe("Venta de Bitcoin");

        expect(
            movementTitle(
                makeMovement({
                    type: "investment_sell",
                    asset: { symbol: "AAPL", name: "Apple" },
                }),
            ),
        ).toBe("Venta de Apple");

        expect(movementTitle(makeMovement({ type: "investment_sell", asset: null }))).toBe("Venta de inversión");
    });

    it("mantiene el texto de los demás tipos", () => {
        expect(movementTitle(makeMovement({ type: "deposit" }))).toBe("Ingreso");
        expect(movementTitle(makeMovement({ type: "exchange_out" }))).toBe("Cambio · salida");
        expect(movementTitle(makeMovement({ type: "exchange_in" }))).toBe("Cambio · entrada");
    });
});
