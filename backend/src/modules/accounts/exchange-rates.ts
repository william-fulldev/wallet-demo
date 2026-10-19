import type { Currency } from "../../models/account.model.js";

// Unidades de cada moneda por 1 EUR, multiplicadas por 1.000.000.
export type UnitsPerEur = Record<Currency, bigint>;

// Respaldo simulado para cuando la API de tasas no responde. Son valores aproximados e inventados.
// Record<Currency, ...> obliga a definir una tasa por cada moneda admitida.
export const FALLBACK_UNITS_PER_EUR: UnitsPerEur = {
    EUR: 1_000_000n,
    USD: 1_120_000n,
    BRL: 5_660_000n,
};

// Convierto un importe en céntimos de una moneda a otra, redondeando hacia abajo.
export function convertCents(
    amountCents: number,
    from: Currency,
    to: Currency,
    unitsPerEur: UnitsPerEur,
): number {
    if (from === to) {
        return amountCents;
    }

    // BigInt evita perder precisión en la multiplicación. Lanza un error si el importe no es entero.
    const converted = (BigInt(amountCents) * unitsPerEur[to]) / unitsPerEur[from];

    // La división de BigInt trunca los decimales, que es el redondeo hacia abajo que busco.
    const result = Number(converted);

    if (!Number.isSafeInteger(result)) {
        throw new Error("El importe convertido es demasiado grande.");
    }

    return result;
}
