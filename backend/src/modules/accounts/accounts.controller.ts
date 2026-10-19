import type { Request, Response } from "express";
import * as z from "zod";
import { getAuthenticatedUserId } from "./auth-context.js";
import {
    DEFAULT_MOVEMENTS_LIMIT,
    currencyParamsSchema,
    depositBodySchema,
    movementsQuerySchema,
    exchangeBodySchema,
} from "./accounts.schemas.js";
import {
    AccountNotFoundError,
    AmountTooSmallError,
    InsufficientFundsError,
    depositToAccount,
    exchangeCurrency,
    listAccounts,
    listMovements,
} from "./accounts.service.js";

// Devuelvo las cuentas del usuario autenticado.
export async function getAccounts(_req: Request, res: Response): Promise<void> {
    const userId = getAuthenticatedUserId(res);

    if (!userId) {
        res.status(401).json({ message: "Autenticación requerida." });
        return;
    }

    const accounts = await listAccounts(userId);
    res.status(200).json({ accounts });
}

// Hago un ingreso simulado en una de las cuentas del usuario autenticado.
export async function deposit(req: Request, res: Response): Promise<void> {
    const userId = getAuthenticatedUserId(res);

    if (!userId) {
        res.status(401).json({ message: "Autenticación requerida." });
        return;
    }

    // Valido por separado la dirección y el cuerpo, porque ambos son entrada del cliente.
    const params = currencyParamsSchema.safeParse(req.params);

    if (!params.success) {
        res.status(400).json({
            message: "Datos no válidos.",
            errors: z.flattenError(params.error).fieldErrors,
        });
        return;
    }

    const body = depositBodySchema.safeParse(req.body);

    if (!body.success) {
        res.status(400).json({
            message: "Datos no válidos.",
            errors: z.flattenError(body.error).fieldErrors,
        });
        return;
    }

    try {
        const result = await depositToAccount(
            userId,
            params.data.currency,
            body.data.amountCents,
        );

        // 201 porque el ingreso crea un movimiento nuevo.
        res.status(201).json(result);
    } catch (error) {
        if (error instanceof AccountNotFoundError) {
            res.status(404).json({ message: error.message });
            return;
        }

        throw error;
    }
}

// Devuelvo una página del historial de movimientos del usuario autenticado.
export async function getMovements(req: Request, res: Response): Promise<void> {
    const userId = getAuthenticatedUserId(res);

    if (!userId) {
        res.status(401).json({ message: "Autenticación requerida." });
        return;
    }

    const query = movementsQuerySchema.safeParse(req.query);

    if (!query.success) {
        res.status(400).json({
            message: "Datos no válidos.",
            errors: z.flattenError(query.error).fieldErrors,
        });
        return;
    }

    const page = await listMovements(userId, {
        limit: query.data.limit ?? DEFAULT_MOVEMENTS_LIMIT,
        before: query.data.before,
        currency: query.data.currency,
    });

    res.status(200).json(page);
}

// Cambio dinero entre dos cuentas del usuario autenticado.
export async function exchange(req: Request, res: Response): Promise<void> {
    const userId = getAuthenticatedUserId(res);

    if (!userId) {
        res.status(401).json({ message: "Autenticación requerida." });
        return;
    }

    const body = exchangeBodySchema.safeParse(req.body);

    if (!body.success) {
        res.status(400).json({
            message: "Datos no válidos.",
            errors: z.flattenError(body.error).fieldErrors,
        });
        return;
    }

    try {
        const result = await exchangeCurrency(
            userId,
            body.data.from,
            body.data.to,
            body.data.amountCents,
        );

        res.status(201).json(result);
    } catch (error) {
        if (error instanceof AccountNotFoundError) {
            res.status(404).json({ message: error.message });
            return;
        }

        // 422: la petición está bien formada, pero no se puede cumplir.
        if (error instanceof InsufficientFundsError || error instanceof AmountTooSmallError) {
            res.status(422).json({ message: error.message });
            return;
        }

        throw error;
    }
}