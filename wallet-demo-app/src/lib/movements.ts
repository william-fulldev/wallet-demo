import type { Counterparty, MovementAsset, MovementMerchant, MovementType } from "../api/types";

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

// El importe es siempre positivo; el tipo marca el sentido.
export function movementSign(type: MovementType): 1 | -1 {
    return type === "exchange_out" ||
        type === "transfer_out" ||
        type === "investment_buy" ||
        type === "payment_out"
        ? -1
        : 1;
}
