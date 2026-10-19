import * as z from "zod";
import { CURRENCIES } from "../../models/account.model.js";

// Valido una moneda: la normalizo y compruebo que esté entre las admitidas.
const currencySchema = z
    .string()
    .trim()
    .toUpperCase()
    .pipe(z.enum(CURRENCIES, { error: "Moneda no admitida." }));

export const currencyParamsSchema = z.object({
    currency: currencySchema,
});

// Fijo el tope de un ingreso simulado: 10.000,00 expresado en céntimos.
export const MAX_DEPOSIT_CENTS = 1_000_000;

// Defino qué datos acepto en el cuerpo de un ingreso.
export const depositBodySchema = z.strictObject({
    amountCents: z
        .number({ error: "El importe debe ser un número." })
        .int("El importe debe ser un número entero de céntimos.")
        .positive("El importe debe ser mayor que cero.")
        .max(MAX_DEPOSIT_CENTS, "El importe supera el máximo permitido por ingreso."),
});

export type DepositInput = z.infer<typeof depositBodySchema>;

// Tope de un cambio simulado: 100.000,00 expresado en céntimos.
export const MAX_EXCHANGE_CENTS = 10_000_000;

export const exchangeBodySchema = z
    .strictObject({
        from: currencySchema,
        to: currencySchema,
        amountCents: z
            .number({ error: "El importe debe ser un número." })
            .int("El importe debe ser un número entero de céntimos.")
            .positive("El importe debe ser mayor que cero.")
            .max(MAX_EXCHANGE_CENTS, "El importe supera el máximo permitido por cambio."),
    })
    .refine((data) => data.from !== data.to, {
        error: "La moneda de destino debe ser distinta de la de origen.",
        path: ["to"],
    });


// Defino los límites de una página de movimientos.
export const DEFAULT_MOVEMENTS_LIMIT = 20;
export const MAX_MOVEMENTS_LIMIT = 50;

// Defino qué acepto en la consulta: /api/accounts/movements?limit=10&before=...&currency=EUR
export const movementsQuerySchema = z.object({
    // Los parámetros de la URL llegan siempre como texto: compruebo que sean dígitos y los convierto.
    limit: z
        .string()
        .regex(/^[0-9]+$/, "El límite debe ser un número entero.")
        .transform(Number)
        .pipe(
            z
                .number()
                .int()
                .min(1, "El límite mínimo es 1.")
                .max(MAX_MOVEMENTS_LIMIT, `El límite máximo es ${MAX_MOVEMENTS_LIMIT}.`),
        )
        .optional(),

    // El cursor es el id de un movimiento: 24 caracteres hexadecimales.
    before: z
        .string()
        .regex(/^[0-9a-fA-F]{24}$/, "El cursor no es válido.")
        .optional(),

    currency: currencySchema.optional(),
});

export type MovementsQuery = z.infer<typeof movementsQuerySchema>;
