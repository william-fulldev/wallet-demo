import { SignJWT, jwtVerify } from "jose";
import { env } from "../config/env.js";

// jose necesita el secreto como bytes, no como texto.
const secretKey = new TextEncoder().encode(env.jwtSecret);

// Fijo en un solo lugar las reglas de mis tokens.
const ALGORITHM = "HS256";
const ISSUER = "wallet-demo-api";
const AUDIENCE = "wallet-demo-client";
const EXPIRATION = "15m";

// Creo un token firmado que identifica al usuario.
export async function signAccessToken(userId: string): Promise<string> {
    return new SignJWT({})
        .setProtectedHeader({ alg: ALGORITHM })
        .setSubject(userId)
        .setIssuedAt()
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .setExpirationTime(EXPIRATION)
        .sign(secretKey);
}

// Compruebo un token y devuelvo el id del usuario que contiene.
// Si la firma, el algoritmo, el emisor, la audiencia o la caducidad fallan, lanza un error.
export async function verifyAccessToken(token: string): Promise<string> {
    const { payload } = await jwtVerify(token, secretKey, {
        algorithms: [ALGORITHM],
        issuer: ISSUER,
        audience: AUDIENCE,
    });

    // Un token válido sin "sub" no me sirve para identificar a nadie.
    if (!payload.sub) {
        throw new Error("El token no contiene un usuario.");
    }

    return payload.sub;
}
