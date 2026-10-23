import {
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonModal,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import { arrowDownOutline, closeOutline, swapHorizontalOutline } from "ionicons/icons";
import React, { useEffect, useState } from "react";
import type { Movement } from "../api/types";
import { formatFullDateTime } from "../lib/dates";
import { formatMoney } from "../lib/money";
import { movementLabel, movementReference, movementSign, movementTitle } from "../lib/movements";
import { Avatar } from "./Avatar";
import { BrandIcon } from "./BrandIcon";

type Props = {
    isOpen: boolean;
    movement: Movement | null;
    onClose: () => void;
};

export const MovementDetailModal: React.FC<Props> = ({ isOpen, movement, onClose }) => {
    // Guarda en estado una copia del movimiento seleccionado para que no desaparezca
    // si la lista se refresca con el modal abierto.
    const [snapshot, setSnapshot] = useState<Movement | null>(movement ? { ...movement } : null);

    useEffect(() => {
        if (movement) {
            setSnapshot({ ...movement });
        }
    }, [movement]);

    // Soporte para cerrar con tecla Escape
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    const active = movement ?? snapshot;
    if (!active) return null;

    const sign = movementSign(active.type);
    const incoming = sign > 0;
    const title = movementTitle(active);
    const label = movementLabel(active.type);
    const formattedAmount = `${incoming ? "+" : "-"}${formatMoney(active.amountCents, active.currency)}`;
    const formattedDate = formatFullDateTime(active.createdAt);
    const reference = movementReference(active);

    const renderDetailIcon = () => {
        if (
            (active.type === "transfer_in" || active.type === "transfer_out") &&
            active.counterparty
        ) {
            return (
                <Avatar
                    name={active.counterparty.name}
                    avatarId={active.counterparty.avatarId}
                    size={56}
                />
            );
        }
        if (active.type === "payment_out") {
            return (
                <BrandIcon
                    brandKey={active.merchant?.key ?? "pago"}
                    name={active.merchant?.name}
                    size={56}
                />
            );
        }
        if (active.type === "investment_buy" || active.type === "investment_sell") {
            return (
                <BrandIcon
                    brandKey={active.asset?.symbol ?? "inversion"}
                    name={active.asset?.name}
                    size={56}
                />
            );
        }
        return (
            <span
                className={`activity-icon activity-icon--large${incoming ? " activity-icon--in" : ""}`}
                aria-hidden="true"
            >
                <IonIcon icon={active.type === "deposit" ? arrowDownOutline : swapHorizontalOutline} />
            </span>
        );
    };

    return (
        <IonModal
            isOpen={isOpen}
            onDidDismiss={onClose}
            className="movement-detail-modal"
            breakpoints={[0, 0.85, 1]}
            initialBreakpoint={0.85}
        >
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Detalle del movimiento</IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={onClose} aria-label="Cerrar modal">
                            <IonIcon icon={closeOutline} aria-hidden="true" />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>

            <IonContent className="ion-padding modal-content">
                <div className="movement-detail__hero">
                    <div className="movement-detail__icon-wrap">
                        {renderDetailIcon()}
                    </div>
                    <h3 className="movement-detail__title">{title}</h3>
                    <p className={`movement-detail__amount${incoming ? " movement-detail__amount--in" : ""}`}>
                        {formattedAmount}
                    </p>
                    <p className="movement-detail__date">{formattedDate}</p>
                </div>

                <div className="movement-detail__card glass panel">
                    <div className="movement-detail__row">
                        <span className="muted">Tipo de operación</span>
                        <strong>{label}</strong>
                    </div>
                    <div className="movement-detail__row">
                        <span className="muted">Estado</span>
                        <span className="movement-detail__status">Completado</span>
                    </div>

                    {active.type === "transfer_in" && (
                        <div className="movement-detail__row">
                            <span className="muted">De</span>
                            <span className="movement-detail__counterparty">
                                {active.counterparty ? (
                                    <>
                                        <Avatar
                                            name={active.counterparty.name}
                                            avatarId={active.counterparty.avatarId}
                                            size={28}
                                        />
                                        <strong>{active.counterparty.name}</strong>
                                    </>
                                ) : (
                                    <strong>—</strong>
                                )}
                            </span>
                        </div>
                    )}

                    {active.type === "transfer_out" && (
                        <div className="movement-detail__row">
                            <span className="muted">Para</span>
                            <span className="movement-detail__counterparty">
                                {active.counterparty ? (
                                    <>
                                        <Avatar
                                            name={active.counterparty.name}
                                            avatarId={active.counterparty.avatarId}
                                            size={28}
                                        />
                                        <strong>{active.counterparty.name}</strong>
                                    </>
                                ) : (
                                    <strong>—</strong>
                                )}
                            </span>
                        </div>
                    )}

                    {active.type === "payment_out" && active.merchant && (
                        <>
                            <div className="movement-detail__row">
                                <span className="muted">Comercio</span>
                                <strong>{active.merchant.name}</strong>
                            </div>
                            {active.merchant.category && (
                                <div className="movement-detail__row">
                                    <span className="muted">Categoría</span>
                                    <strong>{active.merchant.category}</strong>
                                </div>
                            )}
                        </>
                    )}

                    {(active.type === "investment_buy" || active.type === "investment_sell") &&
                        active.asset && (
                            <>
                                <div className="movement-detail__row">
                                    <span className="muted">Activo</span>
                                    <strong>{active.asset.name}</strong>
                                </div>
                                <div className="movement-detail__row">
                                    <span className="muted">Símbolo</span>
                                    <strong>{active.asset.symbol}</strong>
                                </div>
                            </>
                    )}

                    {(active.type === "exchange_in" || active.type === "exchange_out") && (
                        <div className="movement-detail__row">
                            <span className="muted">Cambio de moneda</span>
                            <strong>{active.currency}</strong>
                        </div>
                    )}

                    <div className="movement-detail__row">
                        <span className="muted">Moneda de la cuenta</span>
                        <strong>{active.currency}</strong>
                    </div>

                    <div className="movement-detail__row">
                        <span className="muted">Saldo tras la operación</span>
                        <strong>{formatMoney(active.balanceAfterCents, active.currency)}</strong>
                    </div>

                    <div className="movement-detail__row">
                        <span className="muted">Referencia</span>
                        <code className="movement-detail__ref">{reference}</code>
                    </div>
                </div>

                {active.note && (
                    <div className="movement-detail__note-block glass panel">
                        <span className="muted movement-detail__note-label">Nota</span>
                        <p className="movement-detail__note-text">{active.note}</p>
                    </div>
                )}
            </IonContent>
        </IonModal>
    );
};
