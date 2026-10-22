import { validateBuyForm, validateSellForm } from "./investment-form";

const valid = {
    amountText: "50,00",
    balanceCents: 10_000,
    priceCents: 6_500_000, // 65.000 USD (Bitcoin)
};

describe("validateBuyForm", () => {
    it("acepta una compra correcta calculando las unidades estimadas", () => {
        const result = validateBuyForm(valid);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.amountCents).toBe(5000);
            expect(result.unitsE8).toBe(76_923);
        }
    });

    it.each(["", "abc", "12,505", "0", "0,00"])("rechaza el importe %j", (amountText) => {
        expect(validateBuyForm({ ...valid, amountText }).ok).toBe(false);
    });

    it("rechaza un importe mayor que el saldo en USD", () => {
        const result = validateBuyForm({ ...valid, amountText: "100,01" });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.message).toContain("saldo suficiente");
        }
    });

    it("permite validar si el saldo en USD es aún desconocido (null)", () => {
        const result = validateBuyForm({ ...valid, amountText: "100,01", balanceCents: null });
        expect(result.ok).toBe(true);
    });

    it("rechaza si el importe no da para al menos una unidad mínima", () => {
        // 1 céntimo (amountCents = 1) con activo muy caro (200.000.000 céntimos): 1 * 1e8 / 2e8 = 0
        const result = validateBuyForm({
            amountText: "0,01",
            balanceCents: 100_000,
            priceCents: 200_000_000,
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.message).toContain("demasiado pequeño");
        }
    });

    it("rechaza si el precio del activo no es válido (<= 0)", () => {
        expect(validateBuyForm({ ...valid, priceCents: 0 }).ok).toBe(false);
        expect(validateBuyForm({ ...valid, priceCents: -100 }).ok).toBe(false);
    });
});

describe("validateSellForm", () => {
    const validSell = {
        amountText: "50,00",
        holdingUnitsE8: 50_000_000, // 0.5 unidades de AAPL
        priceCents: 20_000, // 200,00 USD (valor total = 100,00 USD = 10.000 céntimos)
    };

    it("acepta una venta por importe válida calculando unidades con redondeo hacia arriba", () => {
        const result = validateSellForm(validSell);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.isAll).toBe(false);
            expect(result.amountCents).toBe(5000);
            expect(result.unitsE8).toBe(25_000_000); // 50 USD / 200 USD = 0.25 unidades
            expect(result.proceedsCents).toBe(5000);
        }
    });

    it("acepta vender toda la posición (isAll: true)", () => {
        const result = validateSellForm({
            ...validSell,
            amountText: "100,00",
            isAll: true,
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.isAll).toBe(true);
            expect(result.unitsE8).toBe(50_000_000);
            expect(result.proceedsCents).toBe(10_000); // 0.5 * 200 USD = 100 USD
        }
    });

    it.each(["", "abc", "12,505", "0", "0,00", "-5"])("rechaza importe inválido %j", (amountText) => {
        const result = validateSellForm({ ...validSell, amountText });
        expect(result.ok).toBe(false);
    });

    it("rechaza si el usuario no tiene posición (holdingUnitsE8 null o 0)", () => {
        expect(validateSellForm({ ...validSell, holdingUnitsE8: null }).ok).toBe(false);
        expect(validateSellForm({ ...validSell, holdingUnitsE8: 0 }).ok).toBe(false);
    });

    it("rechaza si el importe supera el valor total de la posición", () => {
        const result = validateSellForm({ ...validSell, amountText: "100,01" });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.message).toContain("supera el valor total");
        }
    });

    it("rechaza si el precio del activo no es válido (<= 0)", () => {
        expect(validateSellForm({ ...validSell, priceCents: 0 }).ok).toBe(false);
        expect(validateSellForm({ ...validSell, priceCents: -500 }).ok).toBe(false);
    });
});
