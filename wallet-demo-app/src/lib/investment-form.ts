import { parseToCents } from "./money";
import { calculateHoldingValueCents, estimateSellUnitsE8, estimateUnitsE8 } from "./units";

export type BuyFormInput = {
    amountText: string;
    // null mientras las cuentas aún no han cargado: entonces no se comprueba el saldo.
    balanceCents: number | null;
    priceCents: number;
};

export type BuyFormResult =
    | { ok: true; amountCents: number; unitsE8: number }
    | { ok: false; message: string };

const fail = (message: string): { ok: false; message: string } => ({ ok: false, message });

export function validateBuyForm(input: BuyFormInput): BuyFormResult {
    const amountCents = parseToCents(input.amountText);

    if (amountCents === null) {
        return fail("Escribe un importe válido, con hasta dos decimales.");
    }

    if (amountCents <= 0) {
        return fail("El importe debe ser mayor que cero.");
    }

    if (input.balanceCents !== null && amountCents > input.balanceCents) {
        return fail("No tienes saldo suficiente en USD.");
    }

    if (input.priceCents <= 0) {
        return fail("El precio del activo no es válido.");
    }

    const unitsE8 = estimateUnitsE8(amountCents, input.priceCents);
    if (unitsE8 <= 0) {
        return fail("El importe es demasiado pequeño: al calcular las unidades se obtendría 0.");
    }

    return { ok: true, amountCents, unitsE8 };
}

export type SellFormInput = {
    amountText: string;
    holdingUnitsE8: number | null;
    priceCents: number;
    isAll?: boolean;
};

export type SellFormResult =
    | {
          ok: true;
          isAll: boolean;
          unitsE8: number;
          proceedsCents: number;
          amountCents?: number;
      }
    | { ok: false; message: string };

export function validateSellForm(input: SellFormInput): SellFormResult {
    if (input.priceCents <= 0) {
        return fail("El precio del activo no es válido.");
    }

    if (input.holdingUnitsE8 === null || input.holdingUnitsE8 <= 0) {
        return fail("No dispones de unidades de este activo para vender.");
    }

    if (input.isAll) {
        const proceedsCents = calculateHoldingValueCents(input.holdingUnitsE8, input.priceCents);
        if (proceedsCents < 1) {
            return fail("El valor de la posición es inferior a 1 céntimo.");
        }
        return {
            ok: true,
            isAll: true,
            unitsE8: input.holdingUnitsE8,
            proceedsCents,
        };
    }

    const amountCents = parseToCents(input.amountText);

    if (amountCents === null) {
        return fail("Escribe un importe válido, con hasta dos decimales.");
    }

    if (amountCents <= 0) {
        return fail("El importe debe ser mayor que cero.");
    }

    const positionValueCents = calculateHoldingValueCents(input.holdingUnitsE8, input.priceCents);
    if (amountCents > positionValueCents) {
        return fail("El importe supera el valor total de tu posición.");
    }

    const unitsE8 = estimateSellUnitsE8(amountCents, input.priceCents);
    if (unitsE8 <= 0) {
        return fail("El importe es demasiado pequeño: al calcular las unidades se obtendría 0.");
    }

    if (unitsE8 > input.holdingUnitsE8) {
        return fail("No dispones de suficientes unidades para vender ese importe.");
    }

    return {
        ok: true,
        isAll: false,
        amountCents,
        unitsE8,
        proceedsCents: amountCents,
    };
}

