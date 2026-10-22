import { describe, expect, it } from "vitest";
import { validateTransferForm } from "./transfer-form";

const valid = { contactId: "c1", amountText: "5,00", balanceCents: 10_000, note: "" };

describe("validateTransferForm", () => {
    it("acepta un envío correcto y omite la nota vacía", () => {
        expect(validateTransferForm(valid)).toEqual({ ok: true, amountCents: 500, note: undefined });
    });

    it("recorta la nota", () => {
        expect(validateTransferForm({ ...valid, note: "  cena  " })).toEqual({
            ok: true,
            amountCents: 500,
            note: "cena",
        });
    });

    it("exige destinatario", () => {
        expect(validateTransferForm({ ...valid, contactId: "" }).ok).toBe(false);
    });

    it.each(["", "abc", "12,505", "0", "0,00"])("rechaza el importe %j", (amountText) => {
        expect(validateTransferForm({ ...valid, amountText }).ok).toBe(false);
    });

    it("rechaza un importe mayor que el saldo, pero no si el saldo es desconocido", () => {
        expect(validateTransferForm({ ...valid, amountText: "100,01" }).ok).toBe(false);
        expect(validateTransferForm({ ...valid, amountText: "100,01", balanceCents: null }).ok).toBe(true);
    });

    it("rechaza una nota de más de 140 caracteres", () => {
        expect(validateTransferForm({ ...valid, note: "a".repeat(141) }).ok).toBe(false);
    });
});
