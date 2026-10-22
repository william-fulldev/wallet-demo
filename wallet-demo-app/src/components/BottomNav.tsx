import { IonIcon, IonToast, useIonRouter } from "@ionic/react";
import { addCircleOutline, homeOutline, listOutline, lockClosedOutline, swapHorizontalOutline } from "ionicons/icons";
import { useLocation } from "react-router-dom";
import { useState } from "react";
import { useFeatures } from "../api/queries";

const ITEMS = [
    { path: "/home", label: "Inicio", icon: homeOutline },
    { path: "/movements", label: "Movimientos", icon: listOutline },
    { path: "/exchange", label: "Cambiar", icon: swapHorizontalOutline },
    { path: "/deposit", label: "Ingresar", icon: addCircleOutline },
];

export function BottomNav() {
    const router = useIonRouter();
    const { pathname } = useLocation();
    const features = useFeatures();
    const depositsEnabled = features.data?.depositsEnabled ?? false;
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // slot="fixed" saca la barra del scroll de ion-content.
    return (
        <>
            <nav slot="fixed" className="bottom-nav glass-strong" aria-label="Navegación principal">
                {ITEMS.map((item) => {
                    const active = pathname === item.path;
                    const isDeposit = item.path === "/deposit";
                    const isDisabled = isDeposit && !depositsEnabled;

                    return (
                        <button
                            key={item.path}
                            type="button"
                            className={`nav-btn${active ? " nav-btn--active" : ""}${isDisabled ? " nav-btn--disabled" : ""}`}
                            aria-label={item.label}
                            aria-current={active ? "page" : undefined}
                            aria-disabled={isDisabled ? "true" : undefined}
                            onClick={() => {
                                if (isDisabled) {
                                    setToastMessage("Ingresos desactivados en esta demo.");
                                    return;
                                }
                                router.push(item.path, "root", "replace");
                            }}
                        >
                            <span className="nav-icon-wrapper">
                                <IonIcon icon={item.icon} aria-hidden="true" />
                                {isDisabled && (
                                    <span className="nav-lock-badge" aria-hidden="true">
                                        <IonIcon icon={lockClosedOutline} />
                                    </span>
                                )}
                            </span>
                            {active && <span>{item.label}</span>}
                        </button>
                    );
                })}
            </nav>

            <IonToast
                isOpen={!!toastMessage}
                message={toastMessage ?? ""}
                duration={3000}
                onDidDismiss={() => setToastMessage(null)}
            />
        </>
    );
}

