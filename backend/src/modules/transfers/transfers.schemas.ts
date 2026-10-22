import * as z from "zod";
import { currencySchema } from "../accounts/accounts.schemas.js";

// Tope de un envío simulado: 10.000,00 expresado en céntimos.
export const MAX_TRANSFER_CENTS = 1_000_000;
export const MAX_NOTE_LENGTH = 140;

export const idempotencyKeySchema = z
    .string({ error: "Falta la cabecera Idempotency-Key." })
    .trim()
    .min(8, "La clave de idempotencia es demasiado corta.")
    .max(100, "La clave de idempotencia es demasiado larga.")
    .regex(/^[A-Za-z0-9_-]+$/, "La clave solo admite letras, números, guiones y guiones bajos.");

export const transferBodySchema = z.strictObject({
    contactId: z.string().regex(/^[0-9a-fA-F]{24}$/, "El contacto no es válido."),
    currency: currencySchema,
    amountCents: z
        .number({ error: "El importe debe ser un número." })
        .int("El importe debe ser un número entero de céntimos.")
        .positive("El importe debe ser mayor que cero.")
        .max(MAX_TRANSFER_CENTS, "El importe supera el máximo permitido por envío."),
    note: z
        .string()
        .trim()
        .max(MAX_NOTE_LENGTH, `La nota no puede superar los ${MAX_NOTE_LENGTH} caracteres.`)
        .optional(),
});
