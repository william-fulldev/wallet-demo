import { Schema, model } from "mongoose";

const tradeSchema = new Schema(
    {
        owner: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        symbol: {
            type: String,
            required: true,
            uppercase: true,
            trim: true,
        },
        side: {
            type: String,
            enum: ["buy", "sell"],
            default: "buy",
            required: true,
        },
        isAll: {
            type: Boolean,
            default: false,
        },
        realizedPnlCents: {
            type: Number,
        },
        amountCents: {
            type: Number,
            required: true,
            min: 1,
            validate: {
                validator: Number.isSafeInteger,
                message: "amountCents debe ser un número entero positivo.",
            },
        },
        priceCents: {
            type: Number,
            required: true,
            min: 1,
            validate: {
                validator: Number.isSafeInteger,
                message: "priceCents debe ser un número entero positivo.",
            },
        },
        unitsE8: {
            type: Number,
            required: true,
            min: 1,
            validate: {
                validator: Number.isSafeInteger,
                message: "unitsE8 debe ser un número entero positivo.",
            },
        },
        priceSource: {
            type: String,
            enum: ["live", "cache", "fallback"],
            required: true,
        },
        idempotencyKey: {
            type: String,
            required: true,
            trim: true,
        },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
    },
);

// Garantía de idempotencia: un usuario no puede registrar dos compras con la misma clave
tradeSchema.index({ owner: 1, idempotencyKey: 1 }, { unique: true });

export const Trade = model("Trade", tradeSchema);
