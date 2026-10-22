import {
    IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonInput, IonPage,
    IonSelect, IonSelectOption, IonSpinner, IonText, IonTextarea, IonTitle, IonToolbar,
} from "@ionic/react";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { useAccounts, useContacts, useSendTransfer } from "../api/queries";
import type { Currency } from "../api/types";
import { Avatar } from "../components/Avatar";
import { newIdempotencyKey } from "../lib/idempotency";
import { formatMoney } from "../lib/money";
import { NOTE_MAX_LENGTH, validateTransferForm } from "../lib/transfer-form";

type Step = "form" | "review" | "done";

function errorMessage(error: unknown): string {
    if (error instanceof ApiError) return error.message;
    return "No se pudo completar el envío. Comprueba tu conexión y reintenta.";
}

export default function SendPage() {
    const { contactId: initialContactId } = useParams<{ contactId?: string }>();

    const contacts = useContacts();
    const accounts = useAccounts();
    const send = useSendTransfer();

    const [step, setStep] = useState<Step>("form");
    const [contactId, setContactId] = useState(initialContactId ?? "");
    const [currency, setCurrency] = useState<Currency | "">("");
    const [amountText, setAmountText] = useState("");
    const [note, setNote] = useState("");
    const [formError, setFormError] = useState<string | null>(null);

    // Si se navega a otro destinatario mientras la página sigue montada, actualizo el campo en el formulario
    useEffect(() => {
        if (initialContactId && step === "form") {
            setContactId(initialContactId);
        }
    }, [initialContactId, step]);

    // Vive entre renderizados sin provocarlos: no se pinta, solo se reutiliza.
    const idempotencyKey = useRef<string | null>(null);

    const activeCurrency: Currency | undefined = currency !== "" ? currency : accounts.data?.[0]?.currency;
    const balanceCents = accounts.data?.find((a) => a.currency === activeCurrency)?.balanceCents ?? null;
    const contact = contacts.data?.find((c) => c.id === contactId);
    const validation = validateTransferForm({ contactId, amountText, balanceCents, note });

    function handleReview() {
        if (!validation.ok) {
            setFormError(validation.message);
            return;
        }
        setFormError(null);
        setStep("review");
    }

    function handleConfirm() {
        if (!validation.ok || !activeCurrency) return;

        // Primera vez: clave nueva. Reintento del mismo envío: se reutiliza.
        idempotencyKey.current ??= newIdempotencyKey();

        send.mutate(
            {
                contactId,
                currency: activeCurrency,
                amountCents: validation.amountCents,
                note: validation.note,
                idempotencyKey: idempotencyKey.current,
            },
            { onSuccess: () => setStep("done") },
        );
    }

    function handleEdit() {
        // Si se cambia algo, ya es otro envío: otra clave.
        idempotencyKey.current = null;
        send.reset();
        setStep("form");
    }

    function handleAnother() {
        idempotencyKey.current = null;
        send.reset();
        setAmountText("");
        setNote("");
        setFormError(null);
        setStep("form");
    }

    return (
        <IonPage>
            <IonHeader>
                <IonToolbar>
                    <IonButtons slot="start">
                        <IonBackButton defaultHref="/" />
                    </IonButtons>
                    <IonTitle>Enviar dinero</IonTitle>
                </IonToolbar>
            </IonHeader>

            <IonContent className="ion-padding">
                {step === "form" && (
                    <>
                        <IonSelect
                            label="Destinatario"
                            labelPlacement="stacked"
                            placeholder="Elige un contacto"
                            value={contactId}
                            onIonChange={(e) => setContactId(String(e.detail.value ?? ""))}
                        >
                            {contacts.data?.map((c) => (
                                <IonSelectOption key={c.id} value={c.id}>
                                    {c.name}
                                </IonSelectOption>
                            ))}
                        </IonSelect>

                        <IonSelect
                            label="Moneda"
                            labelPlacement="stacked"
                            value={activeCurrency}
                            onIonChange={(e) => setCurrency(e.detail.value as Currency)}
                        >
                            {accounts.data?.map((a) => (
                                <IonSelectOption key={a.currency} value={a.currency}>
                                    {a.currency} · {formatMoney(a.balanceCents, a.currency)}
                                </IonSelectOption>
                            ))}
                        </IonSelect>

                        <IonInput
                            label="Importe"
                            labelPlacement="stacked"
                            inputMode="decimal"
                            placeholder="0,00"
                            value={amountText}
                            onIonInput={(e) => setAmountText(String(e.detail.value ?? ""))}
                        />

                        <IonTextarea
                            label="Nota (opcional)"
                            labelPlacement="stacked"
                            maxlength={NOTE_MAX_LENGTH}
                            counter
                            value={note}
                            onIonInput={(e) => setNote(String(e.detail.value ?? ""))}
                        />

                        {formError && <IonText color="danger"><p>{formError}</p></IonText>}

                        <IonButton expand="block" onClick={handleReview}>Continuar</IonButton>
                    </>
                )}

                {step === "review" && validation.ok && contact && activeCurrency && (
                    <>
                        <div className="send-summary">
                            <Avatar name={contact.name} avatarId={contact.avatarId} size={72} />
                            <h2>{contact.name}</h2>
                            <p className="send-summary__amount">{formatMoney(validation.amountCents, activeCurrency)}</p>
                            {validation.note && <p>“{validation.note}”</p>}
                        </div>

                        {send.isError && <IonText color="danger"><p>{errorMessage(send.error)}</p></IonText>}

                        <IonButton expand="block" disabled={send.isPending} onClick={handleConfirm}>
                            {send.isPending ? <IonSpinner name="dots" /> : send.isError ? "Reintentar" : "Confirmar envío"}
                        </IonButton>
                        <IonButton expand="block" fill="clear" disabled={send.isPending} onClick={handleEdit}>
                            Editar
                        </IonButton>
                    </>
                )}

                {step === "done" && send.data && (
                    <>
                        <div className="send-summary">
                            <h2>Enviado a {send.data.recipient.name}</h2>
                            <p className="send-summary__amount">
                                {formatMoney(send.data.movement.amountCents, send.data.movement.currency)}
                            </p>
                            <p>
                                Saldo ahora: {formatMoney(send.data.account.balanceCents, send.data.account.currency)}
                            </p>
                        </div>

                        <IonButton expand="block" routerLink="/" routerDirection="root">Volver al inicio</IonButton>
                        <IonButton expand="block" fill="clear" onClick={handleAnother}>Enviar otro</IonButton>
                    </>
                )}
            </IonContent>
        </IonPage>
    );
}
