import { IonIcon } from "@ionic/react";
import { checkmarkOutline, swapVerticalOutline } from "ionicons/icons";
import { useState, type FormEvent } from "react";
import { ApiError } from "../api/client";
import { useAccounts, useExchange } from "../api/queries";
import type { Currency } from "../api/types";
import { AmountInput } from "../components/AmountInput";
import { CurrencyChips } from "../components/CurrencyChips";
import { PageHeader } from "../components/PageHeader";
import { Screen } from "../components/Screen";
import { formatDateTime } from "../lib/dates";
import { centsToInput, formatMoney, parseToCents } from "../lib/money";

const ExchangePage: React.FC = () => {
    const [from, setFrom] = useState<Currency>("EUR");
    const [to, setTo] = useState<Currency>("USD");
    const [amount, setAmount] = useState("");
    const [localError, setLocalError] = useState<string | null>(null);
    const exchange = useExchange();
    const accounts = useAccounts();

    const available = accounts.data?.find((account) => account.currency === from);

    function clearFeedback() {
        setLocalError(null);
        if (!exchange.isPending) exchange.reset();
    }

    // Si eliges en un lado la moneda del otro, las intercambio: nunca quedan iguales.
    function changeFrom(next: Currency) {
        clearFeedback();
        if (next === to) setTo(from);
        setFrom(next);
    }

    function changeTo(next: Currency) {
        clearFeedback();
        if (next === from) setFrom(to);
        setTo(next);
    }

    function swap() {
        clearFeedback();
        setFrom(to);
        setTo(from);
    }

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        exchange.reset();

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
        exchange.mutate({ from, to, amountCents: cents }, { onSuccess: () => setAmount("") });
    }

    const serverFieldError =
        exchange.error instanceof ApiError ? exchange.error.fieldErrors?.amountCents?.[0] : undefined;
    const generalError = exchange.error && !serverFieldError ? exchange.error.message : null;
    const result = exchange.data;

    return (
        <Screen>
            <PageHeader title="Cambiar moneda" />

            <form className="form" onSubmit={handleSubmit} noValidate>
                <CurrencyChips label="Vendo" value={from} onChange={changeFrom} />

                <AmountInput
                    label="Importe a vender"
                    currency={from}
                    value={amount}
                    onChange={(value) => {
                        clearFeedback();
                        setAmount(value);
                    }}
                    error={localError ?? serverFieldError}
                    hint={available ? `Disponible: ${formatMoney(available.balanceCents, from)}` : undefined}
                />

                {available && available.balanceCents > 0 && (
                    <button
                        type="button"
                        className="link"
                        onClick={() => {
                            clearFeedback();
                            setAmount(centsToInput(available.balanceCents));
                        }}
                    >
                        Usar todo el saldo
                    </button>
                )}

                <button type="button" className="icon-btn glass swap-btn" aria-label="Intercambiar monedas" onClick={swap}>
                    <IonIcon icon={swapVerticalOutline} aria-hidden="true" />
                </button>

                <CurrencyChips label="Recibo" value={to} onChange={changeTo} />

                <p className="field-hint">El importe que recibes se calcula con la tasa del momento del cambio.</p>

                {generalError && (
                    <p className="field-error" role="alert">
                        {generalError}
                    </p>
                )}

                <button type="submit" className="btn-primary" disabled={exchange.isPending}>
                    {exchange.isPending ? "Procesando…" : "Cambiar"}
                </button>
            </form>

            {result && (
                <section className="glass result" role="status">
                    <span className="activity-icon activity-icon--in" aria-hidden="true">
                        <IonIcon icon={checkmarkOutline} />
                    </span>
                    <div>
                        <p>
                            <strong>Cambio realizado</strong>
                        </p>
                        <p>
                            Vendiste {formatMoney(result.sold.movement.amountCents, result.sold.movement.currency)} y
                            recibiste {formatMoney(result.bought.movement.amountCents, result.bought.movement.currency)}.
                        </p>
                        <p className="muted">
                            Saldos: {formatMoney(result.sold.account.balanceCents, result.sold.account.currency)} y{" "}
                            {formatMoney(result.bought.account.balanceCents, result.bought.account.currency)}.
                        </p>
                        <p className="muted">
                            {result.rate.source === "api" ? "Tasa de mercado" : "Tasa simulada de respaldo"},{" "}
                            {formatDateTime(result.rate.asOf)}.
                        </p>
                    </div>
                </section>
            )}
        </Screen>
    );
};

export default ExchangePage;
