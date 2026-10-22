import { IonIcon, useIonRouter } from "@ionic/react";
import { chevronBackOutline } from "ionicons/icons";

export function PageHeader({ title }: { title: string }) {
    const router = useIonRouter();

    // Con la barra inferior se navega "en raíz" y puede no haber historial: vuelvo a Inicio.
    function goBack() {
        if (router.canGoBack()) {
            router.goBack();
        } else {
            router.push("/home", "root", "replace");
        }
    }

    return (
        <header className="page-header">
            <button type="button" className="icon-btn glass" aria-label="Volver" onClick={goBack}>
                <IonIcon icon={chevronBackOutline} aria-hidden="true" />
            </button>
            <h1>{title}</h1>
        </header>
    );
}
