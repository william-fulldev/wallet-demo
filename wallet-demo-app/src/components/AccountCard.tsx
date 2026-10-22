
import { IonCard, IonCardHeader, IonCardSubtitle, IonCardTitle } from "@ionic/react";
import type { Account } from "../api/types";
import { formatMoney } from "../lib/money";

export function AccountCard({ account }: { account: Account }) {
    return (
        <IonCard>
            <IonCardHeader>
                <IonCardSubtitle>{account.currency}</IonCardSubtitle>
                <IonCardTitle>{formatMoney(account.balanceCents, account.currency)}</IonCardTitle>
            </IonCardHeader>
        </IonCard>
    );
}
