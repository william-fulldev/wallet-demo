import { describe, expect, it } from "vitest";
import { convertCents, type UnitsPerEur } from "./exchange-rates.js";

// Tasas redondas para poder calcular el resultado a mano.
const rates: UnitsPerEur = {
    EUR: 1_000_000n,
    USD: 1_100_000n,
    BRL: 5_000_000n,
};

describe("convertCents", () => {
    it("devuelve el mismo importe si la moneda no cambia", () => {
        expect(convertCents(1234, "EUR", "EUR", rates)).toBe(1234);
    });

    it("convierte EUR a USD con la tasa", () => {
        expect(convertCents(10_000, "EUR", "USD", rates)).toBe(11_000);
    });

    it("convierte entre dos monedas que no son el euro, pasando por el euro", () => {
        expect(convertCents(11_000, "USD", "BRL", rates)).toBe(50_000);
    });

    it("redondea hacia abajo: nunca entrega un céntimo que no tiene", () => {
        // 3 céntimos de euro son 3,3 céntimos de dólar.
        expect(convertCents(3, "EUR", "USD", rates)).toBe(3);
    });

    it("un importe diminuto puede dar cero", () => {
        expect(convertCents(1, "USD", "EUR", rates)).toBe(0);
    });

    it("rechaza un importe que no es entero", () => {
        expect(() => convertCents(12.5, "EUR", "USD", rates)).toThrow();
    });
});