import { Schema, model } from "mongoose";
import { CURRENCIES } from "./models/account.model.js";

const transferSchema = new Schema(
    {
        sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
        recipient: { type: Schema.Types.ObjectId, ref: "User", required: true },
        currency: { type: String, enum: [...CURRENCIES], required: true },
        amountCents: {
            type: Number,
            required: true,
            min: 1,
            validate: {
                validator: Number.isSafeInteger,
                message: "El importe debe ser un número entero de céntimos.",
            },
        },
        note: { type: String, maxlength: 140, default: "" },
        idempotencyKey: { type: String, required: true },
    },
    { timestamps: { createdAt: true, updatedAt: false } },
);

// Una clave solo puede usarse una vez por remitente: la garantía final la da el índice.
transferSchema.index({ sender: 1, idempotencyKey: 1 }, { unique: true });

export const Transfer = model("Transfer", transferSchema);
