import { createContext, useContext } from "react";
import type { RegisterInput } from "../api/auth.api";
import type { User } from "../api/types";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

export type AuthContextValue = {
    status: AuthStatus;
    user: User | null;
    login: (email: string, password: string) => Promise<void>;
    register: (input: RegisterInput) => Promise<void>;
    logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
    const value = useContext(AuthContext);

    if (!value) {
        throw new Error("useAuth debe usarse dentro de un AuthProvider.");
    }

    return value;
}
