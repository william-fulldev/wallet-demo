import { loadEnvFile } from "node:process";

// Cargo mi configuración local antes de consultar sus valores.
loadEnvFile();

// Leo el entorno y elimino posibles espacios en sus extremos.
const nodeEnv = process.env.NODE_ENV?.trim();

// Compruebo que el entorno sea de los que admite mi aplicación.
if (nodeEnv !== "development" && nodeEnv !== "test" && nodeEnv !== "production") {
    throw new Error("NODE_ENV debe ser development, test o production.");
}

// Leo el puerto como texto antes de convertirlo en un número.
const portText = process.env.PORT?.trim();

// Evito convertir valor vacío o con caracteres que no sea dígitos.
if (!portText || !/^[0-9]+$/.test(portText)) {
    throw new Error("PORT debe contener únicamente dígitos.")
}

// Convierto el texto validado para utilizarlo como puerto del servidor.
const port = Number(portText);

// Limito el puerto a un número entero entre 1 y 65535.
if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT debe ser un número entero entre 1 y 65535.")
}

// Leo la dirección de MongoDB. Es un secreto, así que nunca la muestro en un mensaje.
const mongodbUri = process.env.MONGODB_URI?.trim();

// Compruebo que exista y que use el formato SRV que me da Atlas.
if (!mongodbUri || !mongodbUri.startsWith("mongodb+srv://")) {
    throw new Error("MONGODB_URI debe existir y empezar por mongodb+srv://.");
}

// Detecto si me dejé algún marcador de Atlas sin sustituir, como <db_password>
if (mongodbUri.includes("<") || mongodbUri.includes(">")) {
    throw new Error("MONGODB_URI todavía contiene marcadores sin sustituir.");
}

// Leo el secreto con el que firmaré los tokens. Es un secreto: nunca lo muestro en un mensaje.
const jwtSecret = process.env.JWT_SECRET?.trim();

// Exijo una longitud mínima para impedir secretos fáciles de adivinar.
// 64 caracteres equivalen a 32 bytes (256 bits) escritos en hexadecimal.
if (!jwtSecret || jwtSecret.length < 64) {
    throw new Error("JWT_SECRET debe existir y tener al menos 64 caracteres.");
}

// Leo los días de validez del refresh token. Si no se especifica, uso 7 días por defecto.
const refreshTokenDaysRaw = process.env.REFRESH_TOKEN_DAYS?.trim();
let refreshTokenDays = 7;

if (refreshTokenDaysRaw) {
    if (!/^[0-9]+$/.test(refreshTokenDaysRaw)) {
        throw new Error("REFRESH_TOKEN_DAYS debe contener únicamente dígitos.");
    }
    refreshTokenDays = Number(refreshTokenDaysRaw);
    if (!Number.isInteger(refreshTokenDays) || refreshTokenDays < 1) {
        throw new Error("REFRESH_TOKEN_DAYS debe ser un número entero mayor que 0.");
    }
}

// Leo los orígenes permitidos para CORS (separados por comas).
const corsOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:8100,http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

// Modalidad demo: inactiva por defecto.
const demoModeRaw = process.env.DEMO_MODE?.trim().toLowerCase();
let demoMode = false;
if (demoModeRaw !== undefined && demoModeRaw !== "") {
    if (demoModeRaw !== "true" && demoModeRaw !== "false") {
        throw new Error("DEMO_MODE debe ser true o false.");
    }
    demoMode = demoModeRaw === "true";
}

// Interruptor para ingresos manuales: inactivo por defecto.
const depositsEnabledRaw = process.env.DEPOSITS_ENABLED?.trim().toLowerCase();
let depositsEnabled = false;
if (depositsEnabledRaw !== undefined && depositsEnabledRaw !== "") {
    if (depositsEnabledRaw !== "true" && depositsEnabledRaw !== "false") {
        throw new Error("DEPOSITS_ENABLED debe ser true o false.");
    }
    depositsEnabled = depositsEnabledRaw === "true";
}

// Variable opcional heredada (se ignora sin error si está presente en el entorno).
const demoPassword = process.env.DEMO_PASSWORD?.trim() || undefined;


// Variables opcionales para los proveedores de mercado real.
const finnhubApiKey = process.env.FINNHUB_API_KEY?.trim() || undefined;
const coingeckoDemoApiKey = process.env.COINGECKO_DEMO_API_KEY?.trim() || undefined;

// Caché de mercado: por defecto 60 segundos si no se especifica.
const marketCacheTtlRaw = process.env.MARKET_CACHE_TTL_SECONDS?.trim();
let marketCacheTtlSeconds = 60;
if (marketCacheTtlRaw) {
    if (!/^[0-9]+$/.test(marketCacheTtlRaw)) {
        throw new Error("MARKET_CACHE_TTL_SECONDS debe contener únicamente dígitos.");
    }
    marketCacheTtlSeconds = Number(marketCacheTtlRaw);
    if (!Number.isInteger(marketCacheTtlSeconds) || marketCacheTtlSeconds < 1) {
        throw new Error("MARKET_CACHE_TTL_SECONDS debe ser un número entero mayor que 0.");
    }
}

// Comparto los valores comprobados con el resto de mi backend.
export const env = {
    nodeEnv,
    port,
    mongodbUri,
    jwtSecret,
    REFRESH_TOKEN_DAYS: refreshTokenDays,
    corsOrigins,
    CORS_ORIGINS: corsOrigins,
    DEMO_MODE: demoMode,
    demoMode,
    get DEPOSITS_ENABLED(): boolean {
        return depositsEnabled;
    },
    set DEPOSITS_ENABLED(value: boolean) {
        depositsEnabled = value;
    },
    get depositsEnabled(): boolean {
        return depositsEnabled;
    },
    set depositsEnabled(value: boolean) {
        depositsEnabled = value;
    },
    DEMO_PASSWORD: demoPassword,
    demoPassword,
    FINNHUB_API_KEY: finnhubApiKey,
    COINGECKO_DEMO_API_KEY: coingeckoDemoApiKey,
    MARKET_CACHE_TTL_SECONDS: marketCacheTtlSeconds,
};

