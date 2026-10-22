import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import * as authApi from "../api/auth.api";
import { setSessionExpiredHandler } from "../api/client";
import type { User } from "../api/types";
import { AuthContext, type AuthContextValue, type AuthStatus } from "./AuthContext";
import { getRefreshToken } from "./tokenStorage";

export function AuthProvider({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient();
    const [status, setStatus] = useState<AuthStatus>("loading");
    const [user, setUser] = useState<User | null>(null);

    // Vacío también la caché: no quiero que el siguiente usuario vea datos del anterior.
    const clearSession = useCallback(() => {
        setUser(null);
        setStatus("anonymous");
        queryClient.clear();
    }, [queryClient]);

    // El cliente HTTP avisa aquí cuando el servidor rechaza el refresh token.
    useEffect(() => {
        setSessionExpiredHandler(clearSession);
        return () => setSessionExpiredHandler(null);
    }, [clearSession]);

    // Al abrir la app intento recuperar la sesión guardada.
    useEffect(() => {
        let cancelled = false;

        async function restore() {
            if (!(await getRefreshToken())) {
                if (!cancelled) setStatus("anonymous");
                return;
            }

            try {
                // Sin access token en memoria dará 401 y el cliente renovará solo.
                const me = await authApi.fetchMe();

                if (!cancelled) {
                    setUser(me);
                    setStatus("authenticated");
                }
            } catch {
                if (!cancelled) setStatus("anonymous");
            }
        }

        void restore();

        return () => {
            cancelled = true;
        };
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        setUser(await authApi.login(email, password));
        setStatus("authenticated");
    }, []);

    // El registro no devuelve tokens, así que inicio sesión justo después.
    const register = useCallback(
        async (input: authApi.RegisterInput) => {
            await authApi.register(input);
            await login(input.email, input.password);
        },
        [login],
    );

    const logout = useCallback(async () => {
        try {
            await authApi.logout();
        } finally {
            clearSession();
        }
    }, [clearSession]);

    const value = useMemo<AuthContextValue>(
        () => ({ status, user, login, register, logout }),
        [status, user, login, register, logout],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
