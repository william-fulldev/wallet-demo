import * as z from "zod";
import { MAX_DEPOSIT_CENTS } from "../accounts/accounts.schemas.js";

export const MAX_INVESTMENT_CENTS = MAX_DEPOSIT_CENTS;

export const idempotencyKeySchema = z
    .string({ error: "Falta la cabecera Idempotency-Key." })
    .trim()
    .min(8, "La clave de idempotencia es demasiado corta.")
    .max(100, "La clave de idempotencia es demasiado larga.")
    .regex(/^[A-Za-z0-9_-]+$/, "La clave solo admite letras, números, guiones y guiones bajos.");

// z.strictObject rechaza cualquier propiedad adicional que el cliente intente enviar (como priceCents)
export const buyInvestmentBodySchema = z.strictObject({
    symbol: z
        .string({ error: "El símbolo es obligatorio." })
        .trim()
        .min(1, "El símbolo no puede estar vacío.")
        .max(30, "El símbolo es demasiado largo."),
    amountCents: z
        .number({ error: "El importe debe ser un número." })
        .int("El importe debe ser un número entero de céntimos.")
        .positive("El importe debe ser mayor que cero.")
        .max(MAX_INVESTMENT_CENTS, "El importe supera el máximo permitido por operación."),
});

export type BuyInvestmentInput = z.infer<typeof buyInvestmentBodySchema>;

export const sellByAmountBodySchema = z.strictObject({
    symbol: z
        .string({ error: "El símbolo es obligatorio." })
        .trim()
        .min(1, "El símbolo no puede estar vacío.")
        .max(30, "El símbolo es demasiado largo."),
    amountCents: z
        .number({ error: "El importe debe ser un número." })
        .int("El importe debe ser un número entero de céntimos.")
        .positive("El importe debe ser mayor que cero.")
        .max(MAX_INVESTMENT_CENTS, "El importe supera el máximo permitido por operación."),
});

export const sellAllBodySchema = z.strictObject({
    symbol: z
        .string({ error: "El símbolo es obligatorio." })
        .trim()
        .min(1, "El símbolo no puede estar vacío.")
        .max(30, "El símbolo es demasiado largo."),
    all: z.literal(true, { error: "Debe ser true si se especifica la venta total." }),
});

export const sellInvestmentBodySchema = z.union([sellByAmountBodySchema, sellAllBodySchema]);

export type SellInvestmentInput = z.infer<typeof sellInvestmentBodySchema>;
