import type { Currency } from "../api/types";

const DEFAULT_LOCALE = "es-ES";

// Crear un Intl.NumberFormat es relativamente caro; reutilizo uno por moneda e idioma.
const formatters = new Map<string, Intl.NumberFormat>();

function getFormatter(currency: string, locale: string): Intl.NumberFormat {
    const key = `${locale}:${currency}`;
    let formatter = formatters.get(key);

    if (!formatter) {
        formatter = new Intl.NumberFormat(locale, { style: "currency", currency, useGrouping: "always" });
        formatters.set(key, formatter);
    }

    return formatter;
}

// Solo para MOSTRAR: aquí dividir entre 100 es seguro porque no se vuelve a usar para calcular.
export function formatMoney(
    cents: number,
    currency: string,
    locale: string = DEFAULT_LOCALE,
): string {
    return getFormatter(currency, locale).format(cents / 100);
}

// Acepta "12", "12,5", "12.50". Rechaza todo lo demás, incluidos separadores de miles.
const AMOUNT_PATTERN = /^(\d{1,9})(?:[.,](\d{1,2}))?$/;

// Convierte el texto de un formulario a céntimos enteros, sin pasar por decimales.
export function parseToCents(input: string): number | null {
    const match = AMOUNT_PATTERN.exec(input.trim());

    if (!match) {
        return null;
    }

    const whole = match[1] ?? "0";
    const fraction = (match[2] ?? "").padEnd(2, "0");

    return Number(whole) * 100 + Number(fraction);
}

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
    EUR: "€",
    BRL: "R$",
    USD: "$",
};

// Para rellenar un campo con un saldo: 1550 -> "15,50". Solo operaciones con enteros.
export function centsToInput(cents: number): string {
    const whole = Math.floor(cents / 100);
    const fraction = String(cents % 100).padStart(2, "0");

    return `${whole},${fraction}`;
}
