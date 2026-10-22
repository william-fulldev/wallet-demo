import { IonContent, IonPage, IonRefresher, IonRefresherContent } from "@ionic/react";
import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

type Props = {
    children: ReactNode;
    onRefresh?: () => Promise<unknown>;
};

export function Screen({ children, onRefresh }: Props) {
    return (
        <IonPage>
            <IonContent fullscreen>
                {onRefresh && (
                    <IonRefresher
                        slot="fixed"
                        onIonRefresh={(event) => {
                            void onRefresh().finally(() => event.detail.complete());
                        }}
                    >
                        <IonRefresherContent />
                    </IonRefresher>
                )}
                <main className="screen">{children}</main>
                <BottomNav />
            </IonContent>
        </IonPage>
    );
}
