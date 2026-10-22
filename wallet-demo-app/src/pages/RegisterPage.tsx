import { useIonRouter } from "@ionic/react";
import { useState, type FormEvent } from "react";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { AuthScreen } from "../components/AuthScreen";
import { TextField } from "../components/TextField";

const RegisterPage: React.FC = () => {
    const { register } = useAuth();
    const router = useIonRouter();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<ApiError | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Primer mensaje del servidor para un campo, si lo hay.
    const fieldError = (field: string): string | undefined => error?.fieldErrors?.[field]?.[0];

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        setError(null);
        setSubmitting(true);

        try {
            await register({ name, email, password });
        } catch (caught) {
            setError(caught instanceof ApiError ? caught : new ApiError(0, "No se pudo conectar con el servidor."));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <AuthScreen title="Crea tu cuenta" subtitle="Tendrás cuentas en EUR, BRL y USD desde el primer momento.">
            <form className="glass auth-card" onSubmit={handleSubmit} noValidate>
                <TextField
                    label="Nombre"
                    autoComplete="name"
                    value={name}
                    onChange={setName}
                    error={fieldError("name")}
                />
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
                    autoComplete="new-password"
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
                    {submitting ? "Creando cuenta…" : "Crear cuenta"}
                </button>
            </form>

            <p className="auth-footer">
                ¿Ya tienes cuenta?{" "}
                <button type="button" className="link" onClick={() => router.push("/login")}>
                    Inicia sesión
                </button>
            </p>
        </AuthScreen>
    );
};

export default RegisterPage;
