import { IonIcon } from "@ionic/react";
import { eyeOffOutline, eyeOutline } from "ionicons/icons";
import { useId, useState } from "react";

type Props = {
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: "text" | "email" | "password";
    autoComplete?: string | undefined;
    inputMode?: "text" | "email" | undefined;
    error?: string | undefined;
};

export function TextField({ label, value, onChange, type = "text", autoComplete, inputMode, error }: Props) {
    const id = useId();
    const messageId = `${id}-error`;
    const [visible, setVisible] = useState(false);
    const isPassword = type === "password";

    return (
        <div className="field">
            <label htmlFor={id} className="field-label">
                {label}
            </label>
            <div className={`field-control${error ? " field-control--error" : ""}`}>
                <input
                    id={id}
                    className="field-input"
                    type={isPassword && visible ? "text" : type}
                    value={value}
                    autoComplete={autoComplete}
                    inputMode={inputMode}
                    onChange={(event) => onChange(event.target.value)}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? messageId : undefined}
                />
                {isPassword && (
                    <button
                        type="button"
                        className="field-toggle"
                        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
                        aria-pressed={visible}
                        onClick={() => setVisible((current) => !current)}
                    >
                        <IonIcon icon={visible ? eyeOffOutline : eyeOutline} aria-hidden="true" />
                    </button>
                )}
            </div>
            {error && (
                <p id={messageId} className="field-error" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}
