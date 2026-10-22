import { IonContent, IonPage, IonSpinner } from "@ionic/react";
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function ProtectedRoute({ children }: { children: ReactNode }) {
    const { status } = useAuth();

    // Mientras compruebo la sesión guardada no decido nada: evito un parpadeo hacia /login.
    if (status === "loading") {
        return (
            <IonPage>
                <IonContent className="ion-padding ion-text-center">
                    <IonSpinner />
                </IonContent>
            </IonPage>
        );
    }

    if (status === "anonymous") {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
}
