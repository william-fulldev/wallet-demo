import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

const PUBLIC_PATHS = ["/login", "/register"];

// Una sola pieza decide cuándo sacar al usuario de las pantallas públicas.
// Así Acceso y Registro nunca cambian su contenido según la sesión.
export function AuthRedirect() {
    const { status } = useAuth();
    const { pathname } = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        if (status === "authenticated" && PUBLIC_PATHS.includes(pathname)) {
            navigate("/home", { replace: true });
        }
    }, [status, pathname, navigate]);

    return null;
}
