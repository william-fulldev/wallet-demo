import {
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonModal,
    IonSpinner,
    IonTitle,
    IonToolbar,
    useIonRouter,
} from "@ionic/react";
import { closeOutline } from "ionicons/icons";
import React, { useEffect, useRef, useState } from "react";
import { ApiError } from "../api/client";
import { useAccounts, useBuyInvestment, useInvestments, useSellInvestment } from "../api/queries";
import type { BuyInvestmentResult, MarketAsset, SellInvestmentResult } from "../api/types";
import { newIdempotencyKey } from "../lib/idempotency";
import { validateBuyForm, validateSellForm } from "../lib/investment-form";
import { formatMoney, parseToCents } from "../lib/money";
import { calculateHoldingValueCents, estimateSellUnitsE8, estimateUnitsE8, formatUnits } from "../lib/units";
import { BrandIcon } from "./BrandIcon";

type Props = {
    isOpen: boolean;
    asset: MarketAsset | null;
    initialMode?: "buy" | "sell";
    onClose: () => void;
};

type Step = "form" | "review" | "done";

function errorMessage(error: unknown, action: "compra" | "venta"): string {
    if (error instanceof ApiError) return error.message;
    return `No se pudo realizar la ${action}. Comprueba tu conexión y vuelve a intentarlo.`;
}

export const BuyInvestmentModal: React.FC<Props> = ({
    isOpen,
    asset,
    initialMode = "buy",
    onClose,
}) => {
    const router = useIonRouter();
    const accounts = useAccounts();
    const investments = useInvestments();
    const buyMutation = useBuyInvestment();
    const sellMutation = useSellInvestment();

    const [mode, setMode] = useState<"buy" | "sell">("buy");
    const [step, setStep] = useState<Step>("form");
    const [amountText, setAmountText] = useState("");
    const [isAll, setIsAll] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [lastBuyResult, setLastBuyResult] = useState<BuyInvestmentResult | null>(null);
    const [lastSellResult, setLastSellResult] = useState<SellInvestmentResult | null>(null);
    const lastSellUnitsRef = useRef<number | null>(null);

    // Clave de idempotencia: se genera al confirmar, se reutiliza en reintentos
    // del mismo envío y se descarta al editar o tras el éxito.
    const idempotencyKey = useRef<string | null>(null);

    const usdAccount = accounts.data?.find((acc) => acc.currency === "USD");
    const balanceCents = usdAccount ? usdAccount.balanceCents : null;

    const holding = investments.data?.find((h) => h.symbol === asset?.symbol);
    const hasPosition = Boolean(holding && holding.unitsE8 > 0);
    const holdingUnitsE8 = holding?.unitsE8 ?? 0;
    const holdingValueCents = asset
        ? calculateHoldingValueCents(holdingUnitsE8, asset.priceCents)
        : 0;

    // Sincronizar modo inicial al abrir el modal
    useEffect(() => {
        if (isOpen) {
            if (initialMode === "sell" && hasPosition) {
                setMode("sell");
            } else {
                setMode("buy");
            }
            setStep("form");
            setAmountText("");
            setIsAll(false);
            setFormError(null);
            setLastBuyResult(null);
            setLastSellResult(null);
            idempotencyKey.current = null;
        }
    }, [isOpen, initialMode, asset?.symbol, hasPosition]);

    const buyValidation = asset
        ? validateBuyForm({
              amountText,
              balanceCents,
              priceCents: asset.priceCents,
          })
        : { ok: false as const, message: "No se ha seleccionado ningún activo." };

    const sellValidation = asset
        ? validateSellForm({
              amountText,
              holdingUnitsE8,
              priceCents: asset.priceCents,
              isAll,
          })
        : { ok: false as const, message: "No se ha seleccionado ningún activo." };

    const parsedCents = parseToCents(amountText);
    const liveBuyUnits =
        parsedCents && asset ? estimateUnitsE8(parsedCents, asset.priceCents) : 0;
    const liveSellUnits = isAll
        ? holdingUnitsE8
        : parsedCents && asset
          ? estimateSellUnitsE8(parsedCents, asset.priceCents)
          : 0;
    const liveSellProceedsCents = isAll ? holdingValueCents : (parsedCents ?? 0);

    function handleClose() {
        idempotencyKey.current = null;
        buyMutation.reset();
        sellMutation.reset();
        setStep("form");
        setAmountText("");
        setIsAll(false);
        setFormError(null);
        setLastBuyResult(null);
        setLastSellResult(null);
        onClose();
    }

    function handleTabChange(nextMode: "buy" | "sell") {
        if (nextMode === "sell" && !hasPosition) return;
        setMode(nextMode);
        setStep("form");
        setAmountText("");
        setIsAll(false);
        setFormError(null);
        idempotencyKey.current = null;
        buyMutation.reset();
        sellMutation.reset();
    }

    function handleSellAll() {
        if (!asset || holdingUnitsE8 <= 0) return;
        setIsAll(true);
        setAmountText((holdingValueCents / 100).toFixed(2).replace(".", ","));
        setFormError(null);
    }

    function handleReview() {
        if (mode === "buy") {
            if (!buyValidation.ok) {
                setFormError(buyValidation.message);
                return;
            }
        } else {
            if (!sellValidation.ok) {
                setFormError(sellValidation.message);
                return;
            }
        }
        setFormError(null);
        setStep("review");
    }

    function handleConfirm() {
        if (!asset) return;

        idempotencyKey.current ??= newIdempotencyKey();

        if (mode === "buy") {
            if (!buyValidation.ok) return;

            buyMutation.mutate(
                {
                    symbol: asset.symbol,
                    amountCents: buyValidation.amountCents,
                    idempotencyKey: idempotencyKey.current,
                },
                {
                    onSuccess: (result) => {
                        setLastBuyResult(result);
                        setStep("done");
                    },
                },
            );
        } else {
            if (!sellValidation.ok) return;

            lastSellUnitsRef.current = sellValidation.unitsE8;

            const payload = sellValidation.isAll
                ? {
                      symbol: asset.symbol,
                      all: true as const,
                      idempotencyKey: idempotencyKey.current,
                  }
                : {
                      symbol: asset.symbol,
                      amountCents: sellValidation.amountCents!,
                      idempotencyKey: idempotencyKey.current,
                  };

            sellMutation.mutate(payload, {
                onSuccess: (result) => {
                    setLastSellResult(result);
                    setStep("done");
                },
            });
        }
    }

    function handleEdit() {
        idempotencyKey.current = null;
        if (mode === "buy") {
            buyMutation.reset();
        } else {
            sellMutation.reset();
        }
        setStep("form");
    }

    function handleAnother() {
        idempotencyKey.current = null;
        buyMutation.reset();
        sellMutation.reset();
        setAmountText("");
        setIsAll(false);
        setFormError(null);
        setLastBuyResult(null);
        setLastSellResult(null);
        setStep("form");
    }

    if (!asset) return null;

    const hasNoBalance = balanceCents !== null && balanceCents <= 0;
    const isInsufficient =
        mode === "buy" &&
        (formError?.includes("saldo suficiente") ||
            (!buyValidation.ok && buyValidation.message.includes("saldo suficiente")));

    const currentMutation = mode === "buy" ? buyMutation : sellMutation;

    return (
        <IonModal
            isOpen={isOpen}
            onDidDismiss={handleClose}
            className="investment-buy-modal"
            breakpoints={[0, 0.9, 1]}
            initialBreakpoint={0.9}
        >
            <IonHeader>
                <IonToolbar>
                    <IonTitle>
                        {step === "form" && (
                            <div className="modal-mode-tabs" role="tablist" aria-label="Modo de operación">
                                <button
                                    type="button"
                                    role="tab"
                                    id="modal-tab-buy"
                                    aria-selected={mode === "buy"}
                                    className={`modal-mode-tab${mode === "buy" ? " modal-mode-tab--active" : ""}`}
                                    onClick={() => handleTabChange("buy")}
                                >
                                    Comprar
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    id="modal-tab-sell"
                                    aria-selected={mode === "sell"}
                                    disabled={!hasPosition}
                                    className={`modal-mode-tab${mode === "sell" ? " modal-mode-tab--active" : ""}`}
                                    onClick={() => handleTabChange("sell")}
                                >
                                    Vender
                                </button>
                            </div>
                        )}
                        {step === "review" && (mode === "buy" ? "Confirmar compra" : "Confirmar venta")}
                        {step === "done" && "Operación completada"}
                    </IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={handleClose} aria-label="Cerrar modal">
                            <IonIcon icon={closeOutline} aria-hidden="true" />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>

            <IonContent className="ion-padding modal-content">
                {step === "form" && mode === "buy" && (
                    <div className="buy-form-step">
                        <div className="modal-asset-hero">
                            <BrandIcon brandKey={asset.symbol} name={asset.name} size={54} />
                            <div className="modal-asset-meta">
                                <h3>{asset.name}</h3>
                                <p className="modal-asset-price">
                                    {formatMoney(asset.priceCents, "USD")}
                                    <span className="modal-asset-symbol"> · {asset.symbol}</span>
                                </p>
                            </div>
                        </div>

                        {asset.source === "fallback" && (
                            <div className="modal-notice-badge">
                                <span>Precio de ejemplo</span>
                            </div>
                        )}

                        <div className="modal-balance-row">
                            <span className="muted">Disponible en USD:</span>
                            <strong>
                                {balanceCents !== null ? formatMoney(balanceCents, "USD") : "Cargando..."}
                            </strong>
                        </div>

                        <div className="modal-input-field">
                            <label htmlFor="buy-amount-input">Importe en USD</label>
                            <div className="modal-amount-input-wrap">
                                <input
                                    id="buy-amount-input"
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="0,00"
                                    value={amountText}
                                    onChange={(e) => {
                                        setAmountText(e.target.value);
                                        setFormError(null);
                                    }}
                                />
                                <span className="currency-tag">USD</span>
                            </div>
                            <p className="modal-estimate-label">
                                ≈ {formatUnits(liveBuyUnits)} {asset.symbol}
                            </p>
                        </div>

                        {formError && (
                            <p className="modal-error-text" role="alert">
                                {formError}
                            </p>
                        )}

                        {(hasNoBalance || isInsufficient) && (
                            <div className="modal-insufficient-box">
                                <p>¿No tienes suficiente saldo en USD?</p>
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => {
                                        handleClose();
                                        router.push("/exchange");
                                    }}
                                >
                                    Cambiar EUR a USD
                                </button>
                            </div>
                        )}

                        <button
                            type="button"
                            className="btn-primary modal-action-btn"
                            onClick={handleReview}
                        >
                            Continuar
                        </button>
                    </div>
                )}

                {step === "form" && mode === "sell" && (
                    <div className="buy-form-step">
                        <div className="modal-asset-hero">
                            <BrandIcon brandKey={asset.symbol} name={asset.name} size={54} />
                            <div className="modal-asset-meta">
                                <h3>{asset.name}</h3>
                                <p className="modal-asset-price">
                                    {formatMoney(asset.priceCents, "USD")}
                                    <span className="modal-asset-symbol"> · {asset.symbol}</span>
                                </p>
                            </div>
                        </div>

                        {asset.source === "fallback" && (
                            <div className="modal-notice-badge">
                                <span>Precio de ejemplo</span>
                            </div>
                        )}

                        <div className="modal-balance-row">
                            <span className="muted">Tu posición:</span>
                            <strong>
                                {formatUnits(holdingUnitsE8)} {asset.symbol} ({formatMoney(holdingValueCents, "USD")})
                            </strong>
                        </div>

                        <div className="modal-input-field">
                            <div className="modal-label-row">
                                <label htmlFor="sell-amount-input">Importe a vender en USD</label>
                                <button
                                    type="button"
                                    className="btn-chip"
                                    onClick={handleSellAll}
                                >
                                    Vender todo
                                </button>
                            </div>
                            <div className="modal-amount-input-wrap">
                                <input
                                    id="sell-amount-input"
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="0,00"
                                    value={amountText}
                                    onChange={(e) => {
                                        setAmountText(e.target.value);
                                        setIsAll(false);
                                        setFormError(null);
                                    }}
                                />
                                <span className="currency-tag">USD</span>
                            </div>
                            <p className="modal-estimate-label">
                                ≈ {formatUnits(liveSellUnits)} {asset.symbol} · Recibirás {formatMoney(liveSellProceedsCents, "USD")}
                            </p>
                        </div>

                        {formError && (
                            <p className="modal-error-text" role="alert">
                                {formError}
                            </p>
                        )}

                        <button
                            type="button"
                            className="btn-primary modal-action-btn"
                            onClick={handleReview}
                        >
                            Continuar
                        </button>
                    </div>
                )}

                {step === "review" && (
                    <div className="buy-review-step">
                        <div className="modal-asset-hero">
                            <BrandIcon brandKey={asset.symbol} name={asset.name} size={64} />
                            <h2>{asset.name}</h2>
                            <p className="review-amount">
                                {formatMoney(
                                    mode === "buy"
                                        ? buyValidation.ok
                                            ? buyValidation.amountCents
                                            : 0
                                        : sellValidation.ok
                                          ? sellValidation.proceedsCents
                                          : 0,
                                    "USD",
                                )}
                            </p>
                        </div>

                        <div className="review-details glass">
                            <div className="review-row">
                                <span className="muted">
                                    {mode === "buy" ? "Unidades estimadas" : "Unidades a vender"}
                                </span>
                                <strong>
                                    {formatUnits(
                                        mode === "buy"
                                            ? buyValidation.ok
                                                ? buyValidation.unitsE8
                                                : 0
                                            : sellValidation.ok
                                              ? sellValidation.unitsE8
                                              : 0,
                                    )}{" "}
                                    {asset.symbol}
                                </strong>
                            </div>
                            <div className="review-row">
                                <span className="muted">Precio unitario</span>
                                <span>{formatMoney(asset.priceCents, "USD")}</span>
                            </div>
                            <div className="review-row">
                                <span className="muted">
                                    {mode === "buy" ? "Cuenta de pago" : "Cuenta de abono"}
                                </span>
                                <span>USD</span>
                            </div>
                        </div>

                        {currentMutation.isError && (
                            <p className="modal-error-text" role="alert">
                                {errorMessage(currentMutation.error, mode === "buy" ? "compra" : "venta")}
                            </p>
                        )}

                        <div className="modal-button-group">
                            <button
                                type="button"
                                className="btn-primary modal-action-btn"
                                disabled={currentMutation.isPending}
                                onClick={handleConfirm}
                            >
                                {currentMutation.isPending ? (
                                    <IonSpinner name="dots" />
                                ) : currentMutation.isError ? (
                                    mode === "buy" ? "Reintentar compra" : "Reintentar venta"
                                ) : (
                                    mode === "buy" ? "Confirmar compra" : "Confirmar venta"
                                )}
                            </button>
                            <button
                                type="button"
                                className="btn-ghost modal-action-btn"
                                disabled={currentMutation.isPending}
                                onClick={handleEdit}
                            >
                                Editar
                            </button>
                        </div>
                    </div>
                )}

                {step === "done" && mode === "buy" && lastBuyResult && (
                    <div className="buy-done-step">
                        <div className="modal-done-hero">
                            <BrandIcon brandKey={asset.symbol} name={asset.name} size={64} />
                            <h2>¡Compra realizada!</h2>
                            <p className="done-units-title">
                                Has comprado {formatUnits(lastBuyResult.holding.unitsE8)} {asset.symbol}
                            </p>
                            <p className="done-balance-info">
                                Saldo USD actual: {formatMoney(lastBuyResult.account.balanceCents, "USD")}
                            </p>
                        </div>

                        <div className="modal-button-group">
                            <button
                                type="button"
                                className="btn-primary modal-action-btn"
                                onClick={handleAnother}
                            >
                                Comprar más
                            </button>
                            <button
                                type="button"
                                className="btn-ghost modal-action-btn"
                                onClick={handleClose}
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                )}

                {step === "done" && mode === "sell" && lastSellResult && (
                    <div className="buy-done-step">
                        <div className="modal-done-hero">
                            <BrandIcon brandKey={asset.symbol} name={asset.name} size={64} />
                            <h2>¡Venta realizada!</h2>
                            <p className="done-units-title">
                                Has vendido {formatUnits(lastSellUnitsRef.current ?? 0)} {asset.symbol}
                            </p>
                            <p className="done-balance-info">
                                Dinero recibido: {formatMoney(lastSellResult.movement.amountCents, "USD")}
                            </p>
                            <p className="done-balance-info">
                                Saldo USD actual: {formatMoney(lastSellResult.account.balanceCents, "USD")}
                            </p>
                            <p
                                className={`done-pnl-info ${
                                    lastSellResult.realizedPnlCents > 0
                                        ? "pnl-up"
                                        : lastSellResult.realizedPnlCents < 0
                                          ? "pnl-down"
                                          : "pnl-neutral"
                                }`}
                            >
                                {lastSellResult.realizedPnlCents > 0
                                    ? `Ganancia: +${formatMoney(lastSellResult.realizedPnlCents, "USD")}`
                                    : lastSellResult.realizedPnlCents < 0
                                      ? `Pérdida: ${formatMoney(lastSellResult.realizedPnlCents, "USD")}`
                                      : `Resultado: ${formatMoney(0, "USD")}`}
                            </p>
                        </div>

                        <div className="modal-button-group">
                            <button
                                type="button"
                                className="btn-primary modal-action-btn"
                                onClick={handleClose}
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                )}
            </IonContent>
        </IonModal>
    );
};
