import * as z from "zod";
import { FALLBACK_UNITS_PER_EUR, type UnitsPerEur } from "./exchange-rates.js";

const RATES_URL = "https://fxapi.app/api/eur.json";
const FETCH_TIMEOUT_MS = 3_000;
const FRESH_MS = 5 * 60 * 1000;
const MAX_STALE_MS = 60 * 60 * 1000;
const RATE_SCALE = 1_000_000;
const RETRY_AFTER_FAILURE_MS = 30 * 1000;

// Indico de dónde vienen las tasas, para poder anotarlo en cada cambio.
export type RateSource = "api" | "fallback";

export type RateQuote = {
    unitsPerEur: UnitsPerEur;
    source: RateSource;
    asOf: Date;
};

// Una tasa válida es un número positivo y razonable.
const rateSchema = z.number().positive().lt(1_000_000);

// Valido solo lo que uso. El resto de la respuesta (unas 160 divisas, con algún null) se descarta.
const responseSchema = z.object({
    base: z.literal("EUR"),
    timestamp: z.iso.datetime(),
    rates: z.object({
        USD: rateSchema,
        BRL: rateSchema,
    }),
});

// Convierto una tasa decimal en un entero multiplicado por un millón.
function toUnits(rate: number): bigint {
    const units = BigInt(Math.round(rate * RATE_SCALE));

    if (units <= 0n) {
        throw new Error("La tasa es demasiado pequeña.");
    }

    return units;
}

// Pido las tasas a la API, con tiempo máximo de espera, y valido la respuesta.
async function fetchRates(): Promise<RateQuote> {
    const response = await fetch(RATES_URL, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
        throw new Error(`La API de tasas respondió con el código ${response.status}.`);
    }

    const data = responseSchema.parse(await response.json());

    return {
        unitsPerEur: {
            EUR: BigInt(RATE_SCALE),
            USD: toUnits(data.rates.USD),
            BRL: toUnits(data.rates.BRL),
        },
        source: "api",
        asOf: new Date(data.timestamp),
    };
}

// Guardo en memoria la última respuesta buena y el momento en que la obtuve.
let cache: { quote: RateQuote; fetchedAt: number } | null = null;

// Recuerdo cuándo falló la API por última vez, para no insistir de inmediato.
let lastFailureAt: number | null = null;

// Devuelvo la mejor alternativa disponible cuando la API no sirve.
function backupQuote(now: number): RateQuote {
    // Prefiero una tasa real de hace poco antes que una inventada.
    if (cache && now - cache.fetchedAt < MAX_STALE_MS) {
        return cache.quote;
    }

    return { unitsPerEur: FALLBACK_UNITS_PER_EUR, source: "fallback", asOf: new Date(now) };
}

// Devuelvo tasas: de la caché si son recientes, de la API si no, y de una alternativa si todo falla.
export async function getRates(): Promise<RateQuote> {
    const now = Date.now();

    if (cache && now - cache.fetchedAt < FRESH_MS) {
        return cache.quote;
    }

    // Si la API falló hace poco, no insisto: voy directo a la alternativa.
    if (lastFailureAt !== null && now - lastFailureAt < RETRY_AFTER_FAILURE_MS) {
        return backupQuote(now);
    }

    try {
        const quote = await fetchRates();
        cache = { quote, fetchedAt: now };
        lastFailureAt = null;
        return quote;
    } catch (error) {
        lastFailureAt = now;
        console.error(
            "No se pudieron obtener las tasas reales:",
            error instanceof Error ? error.message : error,
        );

        return backupQuote(now);
    }
}
