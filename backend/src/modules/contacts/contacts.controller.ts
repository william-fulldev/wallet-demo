import type { Request, Response } from "express";
import * as z from "zod";
import { getAuthenticatedUserId } from "../../utils/auth-context.js";
import { addContactBodySchema, contactParamsSchema } from "./contacts.schemas.js";
import {
    CannotAddSelfError,
    ContactAlreadyExistsError,
    ContactNotFoundError,
    ContactTargetNotFoundError,
    addContact,
    listContacts,
    removeContact,
} from "./contacts.service.js";

export async function getContacts(_req: Request, res: Response): Promise<void> {
    const userId = getAuthenticatedUserId(res);

    if (!userId) {
        res.status(401).json({ message: "Autenticación requerida." });
        return;
    }

    res.status(200).json({ contacts: await listContacts(userId) });
}

export async function createContact(req: Request, res: Response): Promise<void> {
    const userId = getAuthenticatedUserId(res);

    if (!userId) {
        res.status(401).json({ message: "Autenticación requerida." });
        return;
    }

    const body = addContactBodySchema.safeParse(req.body);

    if (!body.success) {
        res.status(400).json({
            message: "Datos no válidos.",
            errors: z.flattenError(body.error).fieldErrors,
        });
        return;
    }

    try {
        const contact = await addContact(userId, body.data.email);
        res.status(201).json({ contact });
    } catch (error) {
        if (error instanceof ContactTargetNotFoundError) {
            res.status(404).json({ message: error.message });
            return;
        }

        if (error instanceof CannotAddSelfError) {
            res.status(422).json({ message: error.message });
            return;
        }

        if (error instanceof ContactAlreadyExistsError) {
            res.status(409).json({ message: error.message });
            return;
        }

        throw error;
    }
}

export async function deleteContact(req: Request, res: Response): Promise<void> {
    const userId = getAuthenticatedUserId(res);

    if (!userId) {
        res.status(401).json({ message: "Autenticación requerida." });
        return;
    }

    const params = contactParamsSchema.safeParse(req.params);

    if (!params.success) {
        res.status(400).json({
            message: "Datos no válidos.",
            errors: z.flattenError(params.error).fieldErrors,
        });
        return;
    }

    try {
        await removeContact(userId, params.data.id);
        res.status(204).send();
    } catch (error) {
        if (error instanceof ContactNotFoundError) {
            res.status(404).json({ message: error.message });
            return;
        }

        throw error;
    }
}
