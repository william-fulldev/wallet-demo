import type { NextFunction, Request, Response } from "express";

// Compruebo si el error viene de un JSON mal formado enviado por el cliente.
function isInvalidJsonError(error: unknown): boolean {
    return (
        error instanceof SyntaxError &&
        "type" in error &&
        error.type === "entity.parse.failed"
    );
}

// Recojo todos los errores que nadie más ha tratado.
// Express lo reconoce como manejador de errores porque tiene exactamente cuatro parámetros.
export function errorHandler(
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
): void {
    // Un JSON roto es culpa del cliente, así que respondo 400.
    if (isInvalidJsonError(error)) {
        res.status(400).json({ message: "El cuerpo de la petición no es un JSON válido." });
        return;
    }

    // Cualquier otro error es mío: lo registro en la consola para poder investigarlo.
    console.error(error);

    // Al cliente le doy un mensaje genérico, sin detalles internos.
    res.status(500).json({ message: "Error interno del servidor." });
}