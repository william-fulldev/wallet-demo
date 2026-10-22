import { useIonRouter } from "@ionic/react";
import { useState, type FormEvent } from "react";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { AuthScreen } from "../components/AuthScreen";
import { TextField } from "../components/TextField";

const LoginPage: React.FC = () => {
    const { login } = useAuth();
    const router = useIonRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<ApiError | null>(null);
    const [submitting, setSubmitting] = useState(false);


    const fieldError = (field: string): string | undefined => error?.fieldErrors?.[field]?.[0];

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        setError(null);
        setSubmitting(true);

        try {
            await login(email, password);
        } catch (caught) {
            setError(caught instanceof ApiError ? caught : new ApiError(0, "No se pudo conectar con el servidor."));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <AuthScreen title="Bienvenido de nuevo" subtitle="Inicia sesión para ver tus cuentas.">
            <form className="glass auth-card" onSubmit={handleSubmit} noValidate>
                <TextField
                    label="Correo electrónico"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={setEmail}
                    error={fieldError("email")}
                />
                <TextField
                    label="Contraseña"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={setPassword}
                    error={fieldError("password")}
                />

                {error && !error.fieldErrors && (
                    <p className="field-error" role="alert">
                        {error.message}
                    </p>
                )}

                <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting ? "Entrando…" : "Entrar"}
                </button>
            </form>

            <p className="auth-footer">
                ¿No tienes cuenta?{" "}
                <button type="button" className="link" onClick={() => router.push("/register")}>
                    Crea una
                </button>
            </p>
        </AuthScreen>
    );
};

export default LoginPage;
