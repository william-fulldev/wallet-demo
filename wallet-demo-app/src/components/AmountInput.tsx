import { useId } from "react";
import type { Currency } from "../api/types";
import { CURRENCY_SYMBOLS } from "../lib/money";

type Props = {
    label: string;
    currency: Currency;
    value: string;
    onChange: (value: string) => void;
    error?: string | undefined;
    hint?: string | undefined;
    disabled?: boolean;
};

// Controlo texto, no número: la conversión a céntimos ocurre al enviar.
export function AmountInput({ label, currency, value, onChange, error, hint, disabled }: Props) {
    const inputId = useId();
    const messageId = `${inputId}-message`;

    return (
        <div className={`glass amount-card${error ? " amount-card--error" : ""}${disabled ? " amount-card--disabled" : ""}`}>
            <label htmlFor={inputId} className="section-label">
                {label}
            </label>
            <div className="amount-row">
                <span className="amount-symbol" aria-hidden="true">
                    {CURRENCY_SYMBOLS[currency]}
                </span>
                <input
                    id={inputId}
                    className="amount-input"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0,00"
                    value={value}
                    disabled={disabled}
                    onChange={(event) => onChange(event.target.value)}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error || hint ? messageId : undefined}
                />
            </div>
            {error ? (
                <p id={messageId} className="field-error" role="alert">
                    {error}
                </p>
            ) : hint ? (
                <p id={messageId} className="field-hint">
                    {hint}
                </p>
            ) : null}
        </div>
    );
}
