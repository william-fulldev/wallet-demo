import { IonContent, IonIcon, IonPage } from "@ionic/react";
import { walletOutline } from "ionicons/icons";
import type { ReactNode } from "react";

type Props = {
    title: string;
    subtitle: string;
    children: ReactNode;
};

export function AuthScreen({ title, subtitle, children }: Props) {
    return (
        <IonPage>
            <IonContent fullscreen>
                <main className="screen auth-screen">
                    <header className="brand">
                        <span className="brand-mark" aria-hidden="true">
                            <IonIcon icon={walletOutline} />
                        </span>
                        <h1>{title}</h1>
                        <p className="muted">{subtitle}</p>
                    </header>
                    {children}
                </main>
            </IonContent>
        </IonPage>
    );
}
