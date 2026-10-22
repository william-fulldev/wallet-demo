import type { Response } from "express";

// Devuelvo el id del usuario autenticado, o null si requireAuth no lo dejó disponible.
export function getAuthenticatedUserId(res: Response): string | null {
    // res.locals admite cualquier valor, así que compruebo el tipo antes de usarlo.
    const userId: unknown = res.locals.userId;

    return typeof userId === "string" ? userId : null;
}
