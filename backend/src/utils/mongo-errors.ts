// Detecta el error de MongoDB cuando se rompe un índice único (código 11000).
export function isDuplicateKeyError(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000
    );
}