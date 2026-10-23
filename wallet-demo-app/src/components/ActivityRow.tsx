import { IonIcon } from "@ionic/react";
import { arrowDownOutline, swapHorizontalOutline } from "ionicons/icons";
import type { Movement } from "../api/types";
import { formatMoney } from "../lib/money";
import { movementSign, movementSubtitle, movementTitle } from "../lib/movements";
import { Avatar } from "./Avatar";
import { BrandIcon } from "./BrandIcon";

type Props = {
    movement: Movement;
    showBalance?: boolean;
    onSelect?: (movement: Movement) => void;
};

export function ActivityRow({ movement, showBalance = false, onSelect }: Props) {
    const sign = movementSign(movement.type);
    const incoming = sign > 0;
    const title = movementTitle(movement);
    const subtitle = movementSubtitle(movement);

    const renderIcon = () => {
        if (
            (movement.type === "transfer_in" || movement.type === "transfer_out") &&
            movement.counterparty
        ) {
            return (
                <Avatar
                    name={movement.counterparty.name}
                    avatarId={movement.counterparty.avatarId}
                    size={40}
                />
            );
        }
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

    const formattedAmount = formatMoney(sign * movement.amountCents, movement.currency);
    const ariaLabel = `${title}, ${formattedAmount}`;

    const content = (
        <>
            {renderIcon()}
            <span className="activity-text">
                <strong>{title}</strong>
                <small>{subtitle}</small>
            </span>
            <span className="activity-side">
                <span className={`activity-amount${incoming ? " activity-amount--in" : ""}`}>
                    {formattedAmount}
                </span>
                {showBalance && <small>Saldo {formatMoney(movement.balanceAfterCents, movement.currency)}</small>}
            </span>
        </>
    );

    if (onSelect) {
        return (
            <li className="activity-row activity-row--interactive">
                <button
                    type="button"
                    className="activity-row__btn"
                    onClick={() => onSelect(movement)}
                    aria-label={ariaLabel}
                >
                    {content}
                </button>
            </li>
        );
    }

    return <li className="activity-row">{content}</li>;
}
