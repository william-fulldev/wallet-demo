/**
 * Formatea unidades de un activo (con escala 1e8) mostrando hasta 8 decimales
 * sin ceros a la derecha y separador decimal en coma (es-ES).
 */
export function formatUnits(unitsE8: number): string {
    if (!Number.isFinite(unitsE8) || unitsE8 === 0) {
        return "0";
    }

    const isNegative = unitsE8 < 0;
    const abs = Math.abs(Math.trunc(unitsE8));
    const whole = Math.floor(abs / 1e8);
    const fractionInt = abs % 1e8;
    const wholeStr = whole.toLocaleString("es-ES");

    if (fractionInt === 0) {
        return isNegative ? `-${wholeStr}` : wholeStr;
    }

    const fractionRaw = String(fractionInt).padStart(8, "0");
    const fractionClean = fractionRaw.replace(/0+$/, "");
    const result = `${wholeStr},${fractionClean}`;

    return isNegative ? `-${result}` : result;
}

/**
 * Estima las unidades enteras (escala 1e8) a partir del importe en céntimos
 * y el precio unitario en céntimos, con la misma fórmula entera que el backend.
 */
export function estimateUnitsE8(amountCents: number, priceCents: number): number {
    if (amountCents <= 0 || priceCents <= 0) {
        return 0;
    }

    return Math.floor((amountCents * 1e8) / priceCents);
}

/**
 * Estima las unidades enteras (escala 1e8) al vender por importe en céntimos,
 * redondeando hacia arriba (ceil) como en el servidor.
 */
export function estimateSellUnitsE8(amountCents: number, priceCents: number): number {
    if (amountCents <= 0 || priceCents <= 0) {
        return 0;
    }
    const num = BigInt(amountCents) * 100_000_000n;
    const den = BigInt(priceCents);
    return Number((num + den - 1n) / den);
}

/**
 * Calcula el valor en USD (en céntimos) de unas unidades E8 con redondeo al más cercano,
 * idéntica a la fórmula de valoración y venta total del servidor.
 */
export function calculateHoldingValueCents(unitsE8: number, priceCents: number): number {
    if (unitsE8 <= 0 || priceCents <= 0) {
        return 0;
    }
    const product = BigInt(unitsE8) * BigInt(priceCents);
    return Number((product + 50_000_000n) / 100_000_000n);
}

/**
 * Formatea un porcentaje de variación con signo explícito y dos decimales.
 */
export function formatChangePct(pct: number | null): string {
    if (pct === null || !Number.isFinite(pct)) {
        return "—";
    }

    const sign = pct >= 0 ? "+" : "-";
    const abs = Math.abs(pct).toFixed(2).replace(".", ",");

    return `${sign}${abs} %`;
}
