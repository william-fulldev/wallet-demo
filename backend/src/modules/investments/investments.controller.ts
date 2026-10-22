import type { Request, Response } from "express";
import * as z from "zod";
import { getAuthenticatedUserId } from "../../utils/auth-context.js";
import { AccountNotFoundError } from "../accounts/accounts.service.js";
import {
    buyInvestmentBodySchema,
    idempotencyKeySchema,
    sellInvestmentBodySchema,
} from "./investments.schemas.js";
import {
    AmountTooSmallError,
    buyInvestment,
    IdempotencyKeyReusedError,
    InsufficientFundsError,
    InsufficientUnitsError,
    listInvestments,
    sellInvestment,
    UnknownAssetError,
} from "./investments.service.js";

export async function buyInvestmentController(req: Request, res: Response): Promise<void> {
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

    const body = buyInvestmentBodySchema.safeParse(req.body);

    if (!body.success) {
        res.status(400).json({
            message: "Datos no válidos.",
            errors: z.flattenError(body.error).fieldErrors,
        });
        return;
    }

    try {
        const { replayed, ...result } = await buyInvestment(userId, {
            ...body.data,
            idempotencyKey: key.data,
        });

        if (replayed) {
            res.setHeader("Idempotent-Replayed", "true");
        }

        res.status(replayed ? 200 : 201).json(result);
    } catch (error) {
        if (error instanceof AccountNotFoundError) {
            res.status(404).json({ message: error.message });
            return;
        }

        if (
            error instanceof UnknownAssetError ||
            error instanceof InsufficientFundsError ||
            error instanceof AmountTooSmallError ||
            error instanceof IdempotencyKeyReusedError
        ) {
            res.status(422).json({ message: error.message });
            return;
        }

        throw error;
    }
}

export async function sellInvestmentController(req: Request, res: Response): Promise<void> {
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

    const body = sellInvestmentBodySchema.safeParse(req.body);

    if (!body.success) {
        res.status(400).json({
            message: "Datos no válidos.",
            errors: z.flattenError(body.error).fieldErrors,
        });
        return;
    }

    try {
        const { replayed, ...result } = await sellInvestment(userId, {
            ...body.data,
            idempotencyKey: key.data,
        });

        if (replayed) {
            res.setHeader("Idempotent-Replayed", "true");
        }

        res.status(replayed ? 200 : 201).json(result);
    } catch (error) {
        if (error instanceof AccountNotFoundError) {
            res.status(404).json({ message: error.message });
            return;
        }

        if (
            error instanceof UnknownAssetError ||
            error instanceof InsufficientUnitsError ||
            error instanceof AmountTooSmallError ||
            error instanceof IdempotencyKeyReusedError
        ) {
            res.status(422).json({ message: error.message });
            return;
        }

        throw error;
    }
}

export async function getInvestmentsController(_req: Request, res: Response): Promise<void> {
    const userId = getAuthenticatedUserId(res);

    if (!userId) {
        res.status(401).json({ message: "Autenticación requerida." });
        return;
    }

    const positions = await listInvestments(userId);
    res.status(200).json(positions);
}
