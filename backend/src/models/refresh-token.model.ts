import { Schema, model } from "mongoose";

const refreshTokenSchema = new Schema(
    {
        user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        // Une todos los tokens nacidos de un mismo inicio de sesión.
        familyId: { type: Schema.Types.ObjectId, required: true, index: true },
        // Guardo el hash, nunca el token en claro.
        tokenHash: { type: String, required: true, unique: true },
        expiresAt: { type: Date, required: true },
        revokedAt: { type: Date },
    },
    { timestamps: { createdAt: true, updatedAt: false } },
);

// Índice TTL: MongoDB borra el documento solo cuando llega expiresAt.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = model("RefreshToken", refreshTokenSchema);
