import { Preferences } from "@capacitor/preferences";

const REFRESH_KEY = "wallet.refreshToken";

// En memoria: se pierde al recargar, y eso es intencionado.
let accessToken: string | null = null;

export function getAccessToken(): string | null {
    return accessToken;
}

export function setAccessToken(token: string | null): void {
    accessToken = token;
}

export async function getRefreshToken(): Promise<string | null> {
    const { value } = await Preferences.get({ key: REFRESH_KEY });
    return value;
}

// Guardo la pareja de tokens que devuelven login y refresh.
export async function saveTokens(tokens: {
    accessToken: string;
    refreshToken: string;
}): Promise<void> {
    accessToken = tokens.accessToken;
    await Preferences.set({ key: REFRESH_KEY, value: tokens.refreshToken });
}

export async function clearTokens(): Promise<void> {
    accessToken = null;
    await Preferences.remove({ key: REFRESH_KEY });
}
