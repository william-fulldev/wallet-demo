import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from "../auth/tokenStorage";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
    status: number;
    code?: string;
    fieldErrors: Record<string, string[]> | undefined;

    constructor(
        status: number,
        message: string,
        fieldErrors?: Record<string, string[]>,
        code?: string,
    ) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.fieldErrors = fieldErrors;
        this.code = code;
    }
}

// El AuthContext se registra aquí para enterarse de que la sesión murió.
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null): void {
    onSessionExpired = handler;
}

// Si hay un refresh en curso, todas las peticiones esperan a ese mismo.
let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
    const refreshToken = await getRefreshToken();

    if (!refreshToken) {
        return false;
    }

    // Uso fetch directo, no apiRequest: así un refresh fallido no puede provocar otro refresh.
    const response = await fetch(`${API_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
    });

    // 401 significa que el servidor rechazó el token: la sesión terminó de verdad.
    if (response.status === 401) {
        await clearTokens();
        onSessionExpired?.();
        return false;
    }

    // Un 500 u otro fallo puntual no debe cerrar la sesión del usuario.
    if (!response.ok) {
        return false;
    }

    await saveTokens((await response.json()) as { accessToken: string; refreshToken: string });
    return true;
}

function refreshOnce(): Promise<boolean> {
    refreshInFlight ??= refreshSession().finally(() => {
        refreshInFlight = null;
    });

    return refreshInFlight;
}

// Convierto el fallo de red en un ApiError, con mensaje en español y código 0.
async function safeFetch(input: string, init: RequestInit): Promise<Response> {
    try {
        return await fetch(input, init);
    } catch {
        throw new ApiError(0, "No se pudo conectar con el servidor.");
    }
}

async function toApiError(response: Response): Promise<ApiError> {
    let message = "Error inesperado.";
    let fieldErrors: Record<string, string[]> | undefined;
    let code: string | undefined;

    try {
        const data = (await response.json()) as {
            message?: string;
            errors?: Record<string, string[]>;
            code?: string;
        };
        message = data.message ?? message;
        fieldErrors = data.errors;
        code = data.code;
    } catch {
        // El cuerpo estaba vacío o no era JSON: me quedo con el mensaje genérico.
    }

    return new ApiError(response.status, message, fieldErrors, code);
}

type RequestOptions = {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    // false en login y registro: no tiene sentido renovar sesión ahí.
    auth?: boolean;
    // Cabeceras extra, como Idempotency-key.
    headers?: Record<string, string>;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", body, auth = true, headers: extraHeaders = {} } = options;

    // Se arma en cada intento para que el reintento use el token recién renovado.
    const send = (): Promise<Response> => {
        const headers = new Headers();
        // Las extra van primero: así nunca pueden pisar Content-Type ni Authorization.
        for (const [name, value] of Object.entries(extraHeaders)) {
            headers.set(name, value);
        }

        const token = getAccessToken();

        if (body !== undefined) {
            headers.set("Content-Type", "application/json");
        }

        if (auth && token) {
            headers.set("Authorization", `Bearer ${token}`);
        }

        return safeFetch(`${API_URL}${path}`, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
    };

    let response = await send();

    if (response.status === 401 && auth && (await refreshOnce())) {
        response = await send();
    }

    if (!response.ok) {
        throw await toApiError(response);
    }

    if (response.status === 204) {
        return undefined as T;
    }

    return (await response.json()) as T;
}
