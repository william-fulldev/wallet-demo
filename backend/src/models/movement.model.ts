import { Schema, model } from "mongoose";
import { CURRENCIES } from "./account.model.js";
import { validate } from "zod";

export const MOVEMENT_TYPES = [
    "deposit",
    "exchange_out",
    "exchange_in",
    "transfer_out",
    "transfer_in",
    "investment_buy",
    "investment_sell",
    "payment_out",
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

// Defino los campos de cada apunte del libro de movimientos.
const movementSchema = new Schema(
    {
        // Guardo el usuario dueño del movimiento, para poder listar su historial.
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        // Guardo la cuenta afectada.
        account: {
            type: Schema.Types.ObjectId,
            ref: "Account",
            required: true,
        },

        // Copio la moneda de la cuenta para que el apunte se entienda por sí solo.
        currency: {
            type: String,
            enum: [...CURRENCIES],
            required: true,
        },

        // Guardo qué tipo de operación fue.
        type: {
            type: String,
            enum: [...MOVEMENT_TYPES],
            required: true,
        },

        // Guardo el importe en céntimos. Siempre es positivo: el tipo indica el sentido.
        amountCents: {
            type: Number,
            required: true,
            min: 1,
            validate: {
                validator: Number.isSafeInteger,
                message: "El importe debe ser un número entero de céntimos.",
            },
        },

        // Guardo cuánto quedó en la cuenta justo después de este movimiento.
        balanceAfterCents: {
            type: Number,
            required: true,
            min: 0,
            validate: {
                validator: Number.isSafeInteger,
                message: "El saldo resultante debe ser un número entero de céntimos.",
            },
        },

        // Solo los cambios de moneda rellenan estos campos. Agrupo los dos apuntes de un cambio.
        exchangeId: { type: Schema.Types.ObjectId },

        // Guardo la tasa aplicada para poder explicar el importe más adelante.
        rateSource: { type: String, enum: ["api", "fallback"] },
        rateAsOf: { type: Date },

        // Unidades por 1 EUR, multiplicadas por 1.000.000, de la moneda de origen y de la de destino.
        rateFromUnits: { type: Number, min: 1, validate: { validator: Number.isSafeInteger } },
        rateToUnits: { type: Number, min: 1, validate: { validator: Number.isSafeInteger } },

        // Solo las transferencias rellenan estos campos.
        transferId: { type: Schema.Types.ObjectId },
        counterparty: { type: Schema.Types.ObjectId, ref: "User" },
        note: { type: String, maxlength: 140 },

        // Solo las compras de inversión rellenan estos campos.
        tradeId: { type: Schema.Types.ObjectId, ref: "Trade" },
        asset: {
            symbol: { type: String, trim: true },
            name: { type: String, trim: true },
        },

        // Solo los gastos/pagos de ejemplo rellenan este campo.
        merchantKey: { type: String, trim: true },
    },
    {
        // Un apunte no se modifica nunca, así que solo guardo cuándo se creó.
        timestamps: { createdAt: true, updatedAt: false },
    },
);

// Acelero la consulta más habitual: el historial de un usuario, del más reciente al más antiguo.
movementSchema.index({ user: 1, _id: -1 });

// Para localizar el apunte de un envío al repetirlo.
movementSchema.index({ transferId: 1 }, { sparse: true });

// Para localizar el apunte de una compra de inversión.
movementSchema.index({ tradeId: 1 }, { sparse: true });

// Creo y exporto el modelo con el que trabajaré los movimientos.
export const Movement = model("Movement", movementSchema);
