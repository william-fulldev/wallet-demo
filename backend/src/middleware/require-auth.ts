import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/token.js";

// Dejo pasar la petición solo si trae un token válido en la cabecera Authorization.
export async function requireAuth(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    // El formato esperado es: "Authorization: Bearer <token>".
    const [scheme, token] = req.headers.authorization?.split(" ") ?? [];

    if (scheme !== "Bearer" || !token) {
        res.status(401).json({ message: "Autenticación requerida." });
        return;
    }

    try {
        // Guardo el id del usuario donde los siguientes pasos de esta petición puedan leerlo.
        res.locals.userId = await verifyAccessToken(token);
        next();
    } catch {
        // Firma incorrecta, token caducado o manipulado: el cliente recibe lo mismo.
        res.status(401).json({ message: "Token inválido o caducado." });
    }
}