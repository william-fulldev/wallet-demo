import { describe, expect, it } from "vitest";
import { centsToInput, formatMoney, parseToCents } from "./money";

describe("parseToCents", () => {
    it.each([
        ["12,50", 1250],
        ["12.5", 1250],
        ["12", 1200],
        ["0,05", 5],
        ["1.15", 115],
    ])("convierte %s a %i céntimos sin errores de decimales", (text, cents) => {
        expect(parseToCents(text)).toBe(cents);
    });

    it.each(["12,505", "", "-5", "abc", "1.234,50"])("rechaza %j", (text) => {
        expect(parseToCents(text)).toBeNull();
    });
});

describe("centsToInput", () => {
    it("es la operación inversa de parseToCents", () => {
        for (const cents of [0, 5, 100, 1550, 123_456]) {
            expect(parseToCents(centsToInput(cents))).toBe(cents);
        }
    });
});

describe("formatMoney", () => {
    // El espacio antes del símbolo es un espacio duro: lo normalizo para comparar.
    const normalize = (text: string) => text.replace(/\s/g, " ");

    it("formatea con coma decimal y símbolo", () => {
        expect(normalize(formatMoney(1250, "EUR"))).toBe("12,50 €");
    });

    it("agrupa los miles también con cuatro cifras", () => {
        expect(normalize(formatMoney(123_407, "EUR"))).toBe("1.234,07 €");
    });
});
