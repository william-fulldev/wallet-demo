import { IonIcon } from "@ionic/react";
import { checkmarkOutline, lockClosedOutline } from "ionicons/icons";
import { useState, type FormEvent } from "react";
import { ApiError } from "../api/client";
import { useDeposit, useFeatures } from "../api/queries";
import type { Currency } from "../api/types";
import { AmountInput } from "../components/AmountInput";
import { CurrencyChips } from "../components/CurrencyChips";
import { PageHeader } from "../components/PageHeader";
import { Screen } from "../components/Screen";
import { formatMoney, parseToCents } from "../lib/money";

const QUICK_AMOUNTS = [10, 50, 100, 500];

const DepositPage: React.FC = () => {
    const [currency, setCurrency] = useState<Currency>("EUR");
    const [amount, setAmount] = useState("");
    const [localError, setLocalError] = useState<string | null>(null);
    const deposit = useDeposit();
    const features = useFeatures();

    // Asume false mientras carga para no mostrar activo el formulario por error
    const depositsEnabled = features.data?.depositsEnabled ?? false;

    // Al editar, descarto el aviso anterior (error o resultado), salvo si hay una petición en curso.
    function clearFeedback() {
        setLocalError(null);
        if (!deposit.isPending) deposit.reset();
    }

    function editAmount(value: string) {
        clearFeedback();
        setAmount(value);
    }

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (!depositsEnabled) return;

        deposit.reset();

        const cents = parseToCents(amount);

        if (cents === null) {
            setLocalError("Introduce un importe válido, por ejemplo 12,50.");
            return;
        }

        if (cents < 1) {
            setLocalError("El importe debe ser mayor que cero.");
            return;
        }

        setLocalError(null);
        deposit.mutate({ currency, amountCents: cents }, { onSuccess: () => setAmount("") });
    }

    // El servidor es la autoridad: si rechaza el importe o responde con DEPOSITS_DISABLED,
    // muestro su mensaje sin tratarlo como un error genérico imprevisto.
    const isDepositsDisabled =
        deposit.error instanceof ApiError && deposit.error.code === "DEPOSITS_DISABLED";
    const serverFieldError =
        deposit.error instanceof ApiError ? deposit.error.fieldErrors?.amountCents?.[0] : undefined;
    const generalError = deposit.error && !serverFieldError ? deposit.error.message : null;

    return (
        <Screen>
            <PageHeader title="Ingresar dinero" />

            {!depositsEnabled && (
                <section className="glass banner-disabled" role="alert">
                    <span className="banner-icon" aria-hidden="true">
                        <IonIcon icon={lockClosedOutline} />
                    </span>
                    <div>
                        <p className="banner-title">Ingresos desactivados</p>
                        <p className="banner-text">
                            Los ingresos están desactivados en esta demo. Cada cuenta parte con 500 EUR, 500 USD y 500 BRL.
                        </p>
                    </div>
                </section>
            )}

            <form className="form" onSubmit={handleSubmit} noValidate>
                <CurrencyChips
                    label="Cuenta"
                    value={currency}
                    disabled={!depositsEnabled}
                    onChange={(next) => {
                        clearFeedback();
                        setCurrency(next);
                    }}
                />

                <AmountInput
                    label="Importe"
                    currency={currency}
                    value={amount}
                    disabled={!depositsEnabled}
                    onChange={editAmount}
                    error={localError ?? serverFieldError}
                />

                <div className="quick-row">
                    {QUICK_AMOUNTS.map((quick) => (
                        <button
                            key={quick}
                            type="button"
                            disabled={!depositsEnabled}
                            className="chip chip--small glass"
                            onClick={() => editAmount(String(quick))}
                        >
                            {formatMoney(quick * 100, currency)}
                        </button>
                    ))}
                </div>

                {generalError && (
                    <p className={`field-error${isDepositsDisabled ? " field-error--highlight" : ""}`} role="alert">
                        {generalError}
                    </p>
                )}

                <button type="submit" className="btn-primary" disabled={!depositsEnabled || deposit.isPending}>
                    {deposit.isPending ? "Procesando…" : "Ingresar"}
                </button>
            </form>

            {deposit.data && (
                <section className="glass result" role="status">
                    <span className="activity-icon activity-icon--in" aria-hidden="true">
                        <IonIcon icon={checkmarkOutline} />
                    </span>
                    <div>
                        <p>
                            <strong>Ingreso realizado</strong>
                        </p>
                        <p className="muted">
                            +{formatMoney(deposit.data.movement.amountCents, deposit.data.movement.currency)} · Nuevo
                            saldo {formatMoney(deposit.data.account.balanceCents, deposit.data.account.currency)}
                        </p>
                    </div>
                </section>
            )}
        </Screen>
    );
};

export default DepositPage;
