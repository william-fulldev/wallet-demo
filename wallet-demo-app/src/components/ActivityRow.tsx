import { IonIcon } from "@ionic/react";
import { arrowDownOutline, swapHorizontalOutline } from "ionicons/icons";
import type { Movement } from "../api/types";
import { formatDateTime } from "../lib/dates";
import { formatMoney } from "../lib/money";
import { movementLabel, movementSign, movementTitle } from "../lib/movements";
import { BrandIcon } from "./BrandIcon";

type Props = {
    movement: Movement;
    showBalance?: boolean;
};

export function ActivityRow({ movement, showBalance = false }: Props) {
    const sign = movementSign(movement.type);
    const incoming = sign > 0;
    const isBrand =
        movement.type === "payment_out" ||
        movement.type === "investment_buy" ||
        movement.type === "investment_sell";

    const title = isBrand ? movementTitle(movement) : movementLabel(movement.type);

    const subtitle =
        movement.type === "payment_out" && movement.merchant?.category
            ? `${movement.merchant.category} · ${formatDateTime(movement.createdAt)}`
            : formatDateTime(movement.createdAt);

    const renderIcon = () => {
        if (movement.type === "payment_out") {
            return (
                <BrandIcon
                    brandKey={movement.merchant?.key ?? "pago"}
                    name={movement.merchant?.name}
                    size={40}
                />
            );
        }
        if (movement.type === "investment_buy" || movement.type === "investment_sell") {
            return (
                <BrandIcon
                    brandKey={movement.asset?.symbol ?? "inversion"}
                    name={movement.asset?.name}
                    size={40}
                />
            );
        }
        return (
            <span
                className={`activity-icon${incoming ? " activity-icon--in" : ""}`}
                aria-hidden="true"
            >
                <IonIcon icon={movement.type === "deposit" ? arrowDownOutline : swapHorizontalOutline} />
            </span>
        );
    };

    return (
        <li className="activity-row">
            {renderIcon()}
            <span className="activity-text">
                <strong>{title}</strong>
                <small>{subtitle}</small>
            </span>
            <span className="activity-side">
                <span className={`activity-amount${incoming ? " activity-amount--in" : ""}`}>
                    {formatMoney(sign * movement.amountCents, movement.currency)}
                </span>
                {showBalance && <small>Saldo {formatMoney(movement.balanceAfterCents, movement.currency)}</small>}
            </span>
        </li>
    );
}
