import { parseToCents } from "./money";

export const NOTE_MAX_LENGTH = 140;

export type TransferFormInput = {
    contactId: string;
    amountText: string;
    // null mientras las cuentas aún no han cargado: entonces no se comprueba.
    balanceCents: number | null;
    note: string;
};

export type TransferFormResult =
    | { ok: true; amountCents: number; note: string | undefined }
    | { ok: false; message: string };

const fail = (message: string): TransferFormResult => ({ ok: false, message });

export function validateTransferForm(input: TransferFormInput): TransferFormResult {
    if (!input.contactId) return fail("Elige un destinatario.");

    const amountCents = parseToCents(input.amountText);
    if (amountCents === null) return fail("Escribe un importe válido, con hasta dos decimales.");
    if (amountCents <= 0) return fail("El importe debe ser mayor que cero.");

    if (input.balanceCents !== null && amountCents > input.balanceCents) {
        return fail("No tienes saldo suficiente.");
    }

    const note = input.note.trim();
    if (note.length > NOTE_MAX_LENGTH) {
        return fail(`La nota admite como máximo ${NOTE_MAX_LENGTH} caracteres.`);
    }

    return { ok: true, amountCents, note: note === "" ? undefined : note };
}
