import { apiRequest } from "./client";
import type { Currency, TransferResult } from "./types";

export type SendTransferInput = {
    contactId: string;
    currency: Currency;
    amountCents: number;
    note?: string | undefined;
    // Identifica este intento de envío. Repetirlo no duplica el dinero.
    idempotencyKey: string;
};

export function sendTransfer({ idempotencyKey, ...body }: SendTransferInput): Promise<TransferResult> {
    return apiRequest<TransferResult>("/api/transfers", {
        method: "POST",
        body,
        headers: { "Idempotency-Key": idempotencyKey },
    });
}
