import bcrypt from "bcrypt";

// Defino cuánto trabajo exijo para calcular cada hash.
// Cada +1 duplica el tiempo, y eso encarece los intentos de fuerza bruta.
const SALT_ROUNDS = 12;

// bcrypt solo lee los primeros 72 bytes de una contraseña, así que fijo ese tope.
const MAX_PASSWORD_BYTES = 72;

// Cuento bytes, no caracteres, porque una letra como "ñ" o un emoji ocupa más de uno.
function exceedsMaxLength(password: string): boolean {
    return Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES;
}

// Convierto una contraseña en un hash que sí puedo guardar en la base de datos.
export async function hashPassword(plainPassword: string): Promise<string> {
    // Rechazo las contraseñas demasiado largas en lugar de truncarlas en silencio.
    if (exceedsMaxLength(plainPassword)) {
        throw new Error("La contraseña no puede superar los 72 bytes.");
    }

    return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

// Compruebo si una contraseña coincide con el hash guardado.
export async function verifyPassword(
    plainPassword: string,
    passwordHash: string,
): Promise<boolean> {
    // Una contraseña demasiado larga nunca pudo guardarse, así que no puede ser correcta.
    if (exceedsMaxLength(plainPassword)) {
        return false;
    }

    // Dejo que bcrypt compare, nunca lo hago yo con "===".
    return bcrypt.compare(plainPassword, passwordHash);
}
