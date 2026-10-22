import type { Request, Response } from "express";
import * as z from "zod";
import { getAuthenticatedUserId } from "../../utils/auth-context.js";
import { AccountNotFoundError, InsufficientFundsError } from "../accounts/accounts.service.js";
import { ContactNotFoundError } from "../contacts/contacts.service.js";
import { idempotencyKeySchema, transferBodySchema } from "./transfers.schemas.js";
import { CannotSendToSelfError, IdempotencyKeyReusedError, sendTransfer } from "./transfers.service.js";

export async function createTransfer(req: Request, res: Response): Promise<void> {
    const userId = getAuthenticatedUserId(res);

    if (!userId) {
        res.status(401).json({ message: "Autenticación requerida." });
        return;
    }

    const key = idempotencyKeySchema.safeParse(req.header("Idempotency-Key"));

    if (!key.success) {
        res.status(400).json({
            message: "Cabecera Idempotency-Key no válida.",
            errors: { "Idempotency-Key": key.error.issues.map((issue) => issue.message) },
        });
        return;
    }

    const body = transferBodySchema.safeParse(req.body);

    if (!body.success) {
        res.status(400).json({
            message: "Datos no válidos.",
            errors: z.flattenError(body.error).fieldErrors,
        });
        return;
    }

    try {
        const { replayed, ...result } = await sendTransfer(userId, {
            ...body.data,
            note: body.data.note ?? "",
            idempotencyKey: key.data,
        });

        // 201 si crea el envío; 200 y una cabecera si es una repetición de uno ya procesado.
        if (replayed) {
            res.setHeader("Idempotent-Replayed", "true");
        }

        res.status(replayed ? 200 : 201).json(result);
    } catch (error) {
        if (error instanceof ContactNotFoundError || error instanceof AccountNotFoundError) {
            res.status(404).json({ message: error.message });
            return;
        }

        if (
            error instanceof InsufficientFundsError ||
            error instanceof CannotSendToSelfError ||
            error instanceof IdempotencyKeyReusedError
        ) {
            res.status(422).json({ message: error.message });
            return;
        }

        throw error;
    }
}