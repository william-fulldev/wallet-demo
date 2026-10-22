// Una clave nueva por cada intención de enviar. crypto.randomUUID funciona en
// localhost y en https, que es lo que usará también la app Android.
export function newIdempotencyKey(): string {
    return crypto.randomUUID();
}
