import crypto from "node:crypto";
import mongoose from "mongoose";
import { env } from "../../config/env.js";
import { RefreshToken } from "../../models/refresh-token.model.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export class InvalidRefreshTokenError extends Error {
    constructor() {
        super("Refresh token no válido.");
        this.name = "InvalidRefreshTokenError";
    }
}

function hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
}

async function issueToken(
    userId: mongoose.Types.ObjectId | string,
    familyId: mongoose.Types.ObjectId,
): Promise<string> {
    const token = crypto.randomBytes(32).toString("base64url");

    await RefreshToken.create({
        user: userId,
        familyId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_DAYS * DAY_MS),
    });

    return token;
}

async function revokeFamily(familyId: mongoose.Types.ObjectId): Promise<void> {
    await RefreshToken.updateMany(
        { familyId, revokedAt: null },
        { $set: { revokedAt: new Date() } },
    );
}

// Abre una sesión nueva: primer token de una familia nueva.
export async function startSession(userId: string): Promise<string> {
    return issueToken(userId, new mongoose.Types.ObjectId());
}

// Consume el token recibido y entrega uno nuevo de la misma familia.
export async function rotateRefreshToken(
    token: string,
): Promise<{ userId: string; refreshToken: string }> {
    const tokenHash = hashToken(token);

    // Atómico: solo una petición puede consumir un token concreto.
    const consumed = await RefreshToken.findOneAndUpdate(
        { tokenHash, revokedAt: null, expiresAt: { $gt: new Date() } },
        { $set: { revokedAt: new Date() } },
        { returnDocument: "before" },
    );

    if (!consumed) {
        // Si el token existía pero ya estaba usado, alguien lo reutilizó: cierro toda la familia.
        const known = await RefreshToken.findOne({ tokenHash });

        if (known) {
            await revokeFamily(known.familyId);
        }

        throw new InvalidRefreshTokenError();
    }

    const refreshToken = await issueToken(consumed.user, consumed.familyId);

    return { userId: consumed.user.toString(), refreshToken };
}

// Cierra la sesión entera. Es idempotente: un token desconocido no es un error.
export async function revokeSession(token: string): Promise<void> {
    const known = await RefreshToken.findOne({ tokenHash: hashToken(token) });

    if (known) {
        await revokeFamily(known.familyId);
    }
}

// Revoca todas las sesiones activas (refresh tokens) de un usuario concreto.
export async function revokeAllUserSessions(
    userId: string | mongoose.Types.ObjectId,
): Promise<number> {
    const result = await RefreshToken.updateMany(
        { user: userId, revokedAt: null },
        { $set: { revokedAt: new Date() } },
    );
    return result.modifiedCount ?? 0;
}