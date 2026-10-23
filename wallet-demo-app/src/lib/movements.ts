import type { Counterparty, MovementAsset, MovementMerchant, MovementType } from "../api/types";
import { formatDateTime } from "./dates";

const LABELS: Record<MovementType, string> = {
    deposit: "Ingreso",
    exchange_out: "Cambio · salida",
    exchange_in: "Cambio · entrada",
    transfer_out: "Envío",
    transfer_in: "Recepción",
    investment_buy: "Compra de inversión",
    investment_sell: "Venta de inversión",
    payment_out: "Pago",
};

export function movementLabel(type: MovementType): string {
    return LABELS[type];
}

export function movementTitle(
    movement: {
        type: MovementType;
        counterparty?: Counterparty | null;
        asset?: MovementAsset | null;
        merchant?: MovementMerchant | null;
    },
): string {
    if (movement.type === "transfer_out") {
        return movement.counterparty ? `Enviado a ${movement.counterparty.name}` : "Envío";
    }
    if (movement.type === "transfer_in") {
        return movement.counterparty ? `Recibido de ${movement.counterparty.name}` : "Dinero recibido";
    }
    if (movement.type === "payment_out") {
        return movement.merchant?.name ? movement.merchant.name : LABELS.payment_out;
    }
    if (movement.type === "investment_buy") {
        return movement.asset?.name ? `Compra de ${movement.asset.name}` : LABELS.investment_buy;
    }
    if (movement.type === "investment_sell") {
        return movement.asset?.name ? `Venta de ${movement.asset.name}` : LABELS.investment_sell;
    }
    return movementLabel(movement.type);
}

// Subtítulo con nota en transferencias, categoría en comercios o la fecha formateada.
export function movementSubtitle(
    movement: {
        type: MovementType;
        createdAt: string;
        note?: string | null;
        merchant?: MovementMerchant | null;
    },
    formatDate: (iso: string) => string = formatDateTime,
): string {
    const formattedDate = formatDate(movement.createdAt);
    if ((movement.type === "transfer_in" || movement.type === "transfer_out") && movement.note) {
        return `${movement.note} · ${formattedDate}`;
    }
    if (movement.type === "payment_out" && movement.merchant?.category) {
        return `${movement.merchant.category} · ${formattedDate}`;
    }
    return formattedDate;
}

// Referencia del movimiento: los últimos 8 caracteres de transferId o del propio id.
export function movementReference(
    movement: {
        id: string;
        transferId?: string | null;
    },
): string {
    const raw = movement.transferId || movement.id;
    return raw.length > 8 ? raw.slice(-8) : raw;
}

// El importe es siempre positivo; el tipo marca el sentido.
export function movementSign(type: MovementType): 1 | -1 {
    return type === "exchange_out" ||
        type === "transfer_out" ||
        type === "investment_buy" ||
        type === "payment_out"
        ? -1
        : 1;
}
