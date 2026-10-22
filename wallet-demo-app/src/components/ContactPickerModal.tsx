import {
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonModal,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    useIonRouter,
} from "@ionic/react";
import { closeOutline } from "ionicons/icons";
import React, { useRef, useState } from "react";
import { useContacts } from "../api/queries";
import type { Contact } from "../api/types";
import { Avatar } from "./Avatar";

type Props = {
    isOpen: boolean;
    onClose: () => void;
};

export const ContactPickerModal: React.FC<Props> = ({ isOpen, onClose }) => {
    const router = useIonRouter();
    const contacts = useContacts();

    // Referencia para posponer la navegación hasta que el modal termine de desmontarse
    const pendingContactId = useRef<string | null>(null);
    const [isSelecting, setIsSelecting] = useState(false);

    function handleSelect(contact: Contact) {
        if (isSelecting) return;
        setIsSelecting(true);
        pendingContactId.current = contact.id;
        onClose();
    }

    function handleDidDismiss() {
        const targetId = pendingContactId.current;
        pendingContactId.current = null;
        setIsSelecting(false);
        onClose();

        if (targetId) {
            router.push(`/send/${targetId}`);
        }
    }

    return (
        <IonModal
            isOpen={isOpen}
            onDidDismiss={handleDidDismiss}
            className="contact-picker-modal"
            breakpoints={[0, 0.75, 1]}
            initialBreakpoint={0.75}
        >
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Elegir contacto</IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={onClose} aria-label="Cerrar modal">
                            <IonIcon icon={closeOutline} aria-hidden="true" />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>

            <IonContent className="ion-padding modal-content">
                {contacts.isPending && (
                    <div className="contact-picker__loading" aria-busy="true" aria-label="Cargando contactos">
                        {[0, 1, 2, 3, 4].map((n) => (
                            <div key={n} className="contact-picker__skeleton-row">
                                <IonSkeletonText
                                    animated
                                    style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0 }}
                                />
                                <IonSkeletonText animated style={{ width: "50%", height: 16 }} />
                            </div>
                        ))}
                    </div>
                )}

                {contacts.isError && (
                    <div className="contact-picker__state glass panel" role="alert">
                        <p>No se pudieron cargar los contactos.</p>
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => void contacts.refetch()}
                        >
                            Reintentar
                        </button>
                    </div>
                )}

                {contacts.isSuccess && contacts.data.length === 0 && (
                    <div className="contact-picker__state">
                        <p className="muted">No hay contactos disponibles.</p>
                    </div>
                )}

                {contacts.isSuccess && contacts.data.length > 0 && (
                    <ul className="contact-picker__list" role="list">
                        {contacts.data.map((contact) => (
                            <li key={contact.id} className="contact-picker__list-item">
                                <button
                                    type="button"
                                    className="contact-picker__row-btn"
                                    onClick={() => handleSelect(contact)}
                                    disabled={isSelecting}
                                    aria-label={`Enviar a ${contact.name}`}
                                >
                                    <Avatar name={contact.name} avatarId={contact.avatarId} size={44} />
                                    <span className="contact-picker__name">{contact.name}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </IonContent>
        </IonModal>
    );
};
