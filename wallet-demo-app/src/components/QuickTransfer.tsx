import { IonIcon, IonSkeletonText, useIonRouter } from "@ionic/react";
import { addOutline } from "ionicons/icons";
import { useRef, useState } from "react";
import { useContacts } from "../api/queries";
import { Avatar } from "./Avatar";
import { ContactPickerModal } from "./ContactPickerModal";

export function QuickTransfer() {
  const contacts = useContacts();
  const router = useIonRouter();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const otherButtonRef = useRef<HTMLButtonElement>(null);

  // Muestra hasta 4 contactos de la respuesta ordenada
  const visibleContacts = contacts.data?.slice(0, 4) ?? [];

  function handleOpenPicker() {
    setIsPickerOpen(true);
  }

  function handleClosePicker() {
    setIsPickerOpen(false);
    requestAnimationFrame(() => {
      otherButtonRef.current?.focus();
    });
  }

  return (
    <section
      className="glass-card quick-transfer"
      aria-labelledby="quick-transfer-title"
    >
      <h2 id="quick-transfer-title">Transferencia rápida</h2>

      <div className="quick-transfer__row">
        {contacts.isPending &&
          [0, 1, 2, 3].map((n) => (
            <div key={n} className="quick-transfer__item">
              <IonSkeletonText
                animated
                style={{ width: 44, height: 44, borderRadius: "50%" }}
              />
              <IonSkeletonText animated style={{ width: 36, height: 10 }} />
            </div>
          ))}

        {visibleContacts.map((contact) => (
          <button
            key={contact.id}
            type="button"
            className="quick-transfer__item"
            onClick={() => router.push(`/send/${contact.id}`)}
            aria-label={`Enviar a ${contact.name}`}
          >
            <Avatar name={contact.name} avatarId={contact.avatarId} size={44} />
            <span className="quick-transfer__name">
              {contact.name.split(" ")[0]}
            </span>
          </button>
        ))}

        {/* Quinto elemento fijo: abre el selector con todos los contactos */}
        <button
          ref={otherButtonRef}
          type="button"
          className="quick-transfer__item quick-transfer__item--more"
          onClick={handleOpenPicker}
          aria-label="Elegir otro contacto"
        >
          <span className="quick-transfer__add">
            <IonIcon icon={addOutline} aria-hidden="true" />
          </span>
          <span className="quick-transfer__name">Otros</span>
        </button>
      </div>

      {contacts.isError && (
        <p className="quick-transfer__hint" role="alert">
          No se pudieron cargar los contactos.{" "}
          <button type="button" onClick={() => void contacts.refetch()}>
            Reintentar
          </button>
        </p>
      )}

      {contacts.isSuccess && contacts.data.length === 0 && (
        <p className="quick-transfer__hint">
          No hay contactos disponibles.
        </p>
      )}

      <ContactPickerModal
        isOpen={isPickerOpen}
        onClose={handleClosePicker}
      />
    </section>
  );
}
