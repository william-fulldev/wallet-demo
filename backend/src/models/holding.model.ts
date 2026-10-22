import { Schema, model } from "mongoose";

const holdingSchema = new Schema(
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
        // Unidades en escala E8 (1 unidad = 100.000.000)
        unitsE8: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
            validate: {
                validator: Number.isSafeInteger,
                message: "unitsE8 debe ser un número entero.",
            },
        },
        // Dinero invertido total en céntimos de USD
        investedCents: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
            validate: {
                validator: Number.isSafeInteger,
                message: "investedCents debe ser un número entero de céntimos.",
            },
        },
    },
    {
        timestamps: true,
    },
);

// Un usuario solo tiene una posición por activo
holdingSchema.index({ owner: 1, symbol: 1 }, { unique: true });

export const Holding = model("Holding", holdingSchema);
