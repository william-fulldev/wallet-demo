import {
    siApple,
    siBitcoin,
    siGoogle,
    siNetflix,
    siSpotify,
    siStarbucks,
    siTesla,
    siUber,
    siZara,
} from "simple-icons";
import { initialsOf } from "./avatars";

export type ResolvedBrand = {
    key: string;
    name: string;
    path: string | null;
    hex: string;
    fallbackText: string;
};

type CatalogEntry = {
    name: string;
    path: string | null;
    hex: string;
    fallbackText?: string;
};

// Simple Icons incluye Netflix, Spotify, Starbucks, Zara, Uber, Apple, Bitcoin, Google y Tesla.
// Amazon y Microsoft no están en el paquete por motivos de marca registrada; se resuelven con respaldo.
const BRAND_CATALOG: Record<string, CatalogEntry> = {
    netflix: {
        name: "Netflix",
        path: siNetflix.path,
        hex: siNetflix.hex,
    },
    spotify: {
        name: "Spotify",
        path: siSpotify.path,
        hex: siSpotify.hex,
    },
    starbucks: {
        name: "Starbucks",
        path: siStarbucks.path,
        hex: siStarbucks.hex,
    },
    zara: {
        name: "Zara",
        path: siZara.path,
        hex: "000000",
    },
    amazon: {
        name: "Amazon",
        path: null,
        hex: "FF9900",
        fallbackText: "AM",
    },
    uber: {
        name: "Uber",
        path: siUber.path,
        hex: "000000",
    },
    apple: {
        name: "Apple",
        path: siApple.path,
        hex: "000000",
    },
    btc: {
        name: "Bitcoin",
        path: siBitcoin.path,
        hex: siBitcoin.hex,
        fallbackText: "BTC",
    },
    aapl: {
        name: "Apple",
        path: siApple.path,
        hex: "000000",
        fallbackText: "AAPL",
    },
    googl: {
        name: "Google",
        path: siGoogle.path,
        hex: siGoogle.hex,
        fallbackText: "GOOGL",
    },
    amzn: {
        name: "Amazon",
        path: null,
        hex: "FF9900",
        fallbackText: "AMZN",
    },
    msft: {
        name: "Microsoft",
        path: null,
        hex: "00A4EF",
        fallbackText: "MSFT",
    },
    tsla: {
        name: "Tesla",
        path: siTesla.path,
        hex: siTesla.hex,
        fallbackText: "TSLA",
    },
};

/**
 * Resuelve una marca o activo por su clave o símbolo.
 * Siempre devuelve un resultado válido, usando el respaldo si no hay icono o la clave es desconocida.
 */
export function resolveBrand(key: string, customName?: string | null): ResolvedBrand {
    const normalizedKey = (key || "").trim().toLowerCase();
    const entry = BRAND_CATALOG[normalizedKey];

    if (entry) {
        const fallbackText = entry.fallbackText ?? initialsOf(customName || entry.name);
        return {
            key: normalizedKey,
            name: customName || entry.name,
            path: entry.path,
            hex: entry.hex,
            fallbackText,
        };
    }

    // Clave desconocida: nunca falla, usa iniciales o símbolo
    const name = (customName || key || "Desconocido").trim();
    const fallbackText = key && key.length <= 4 ? key.toUpperCase() : initialsOf(name);

    return {
        key: normalizedKey,
        name,
        path: null,
        hex: "64748B",
        fallbackText,
    };
}
