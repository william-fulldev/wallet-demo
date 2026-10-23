import { describe, expect, it } from "vitest";
import type { Movement } from "../api/types";
import { movementReference, movementSign, movementSubtitle, movementTitle } from "./movements";

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

describe("movementSubtitle", () => {
    const fixedDate = "2026-10-21T10:00:00.000Z";
    const fakeFormat = () => "21 oct 2026, 12:00";

    it("muestra nota y fecha en transferencias con nota", () => {
        expect(
            movementSubtitle(
                makeMovement({ type: "transfer_in", note: "Cena de ayer", createdAt: fixedDate }),
                fakeFormat,
            ),
        ).toBe("Cena de ayer · 21 oct 2026, 12:00");

        expect(
            movementSubtitle(
                makeMovement({ type: "transfer_out", note: "Gasolina viaje", createdAt: fixedDate }),
                fakeFormat,
            ),
        ).toBe("Gasolina viaje · 21 oct 2026, 12:00");
    });

    it("muestra solo la fecha en transferencias sin nota", () => {
        expect(
            movementSubtitle(
                makeMovement({ type: "transfer_in", note: null, createdAt: fixedDate }),
                fakeFormat,
            ),
        ).toBe("21 oct 2026, 12:00");

        expect(
            movementSubtitle(
                makeMovement({ type: "transfer_out", note: null, createdAt: fixedDate }),
                fakeFormat,
            ),
        ).toBe("21 oct 2026, 12:00");
    });

    it("muestra categoría y fecha en pagos con categoría", () => {
        expect(
            movementSubtitle(
                makeMovement({
                    type: "payment_out",
                    merchant: { key: "spotify", name: "Spotify", category: "Música" },
                    createdAt: fixedDate,
                }),
                fakeFormat,
            ),
        ).toBe("Música · 21 oct 2026, 12:00");
    });

    it("muestra solo la fecha en ingresos, cambios e inversiones", () => {
        expect(movementSubtitle(makeMovement({ type: "deposit", createdAt: fixedDate }), fakeFormat)).toBe(
            "21 oct 2026, 12:00",
        );
        expect(movementSubtitle(makeMovement({ type: "exchange_out", createdAt: fixedDate }), fakeFormat)).toBe(
            "21 oct 2026, 12:00",
        );
        expect(movementSubtitle(makeMovement({ type: "investment_buy", createdAt: fixedDate }), fakeFormat)).toBe(
            "21 oct 2026, 12:00",
        );
    });
});

describe("movementReference", () => {
    it("devuelve los últimos 8 caracteres del transferId si existe", () => {
        expect(movementReference({ id: "1234567890abcdef", transferId: "transfer-12345678" })).toBe("12345678");
    });

    it("devuelve los últimos 8 caracteres del id si transferId no existe", () => {
        expect(movementReference({ id: "6716bc2696b9f2e3410a0001", transferId: null })).toBe("3410a0001".slice(-8));
    });

    it("devuelve el id completo si tiene 8 caracteres o menos", () => {
        expect(movementReference({ id: "m1", transferId: null })).toBe("m1");
    });
});
