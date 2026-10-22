import { clearTokens, getRefreshToken, saveTokens } from "../auth/tokenStorage";
import { apiRequest } from "./client";
import type { User } from "./types";

export type RegisterInput = { name: string; email: string; password: string };

export async function register(input: RegisterInput): Promise<User> {
    const data = await apiRequest<{ user: User }>("/api/auth/register", {
        method: "POST",
        body: input,
        auth: false,
    });

    return data.user;
}

export async function login(email: string, password: string): Promise<User> {
    const data = await apiRequest<{ user: User; accessToken: string; refreshToken: string }>(
        "/api/auth/login",
        { method: "POST", body: { email, password }, auth: false },
    );

    await saveTokens(data);
    return data.user;
}

export async function fetchMe(): Promise<User> {
    const data = await apiRequest<{ user: User }>("/api/auth/me");
    return data.user;
}

export async function logout(): Promise<void> {
    const refreshToken = await getRefreshToken();

    try {
        if (refreshToken) {
            await apiRequest<void>("/api/auth/logout", {
                method: "POST",
                body: { refreshToken },
                auth: false,
            });
        }
    } finally {
        // Aunque el servidor falle, el usuario queda desconectado en este dispositivo.
        await clearTokens();
    }
}
