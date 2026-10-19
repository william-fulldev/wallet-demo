import { Schema, model } from "mongoose";

// Defino las monedas que admite mi wallet. Las exporto para reutilizarlas al validar peticiones.
export const CURRENCIES = ["EUR", "BRL", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

// Defino los campos y las reglas de las cuentas de mi wallet.
const accountSchema = new Schema(
    {
        // Relaciono cada cuenta con el usuario al que pertenece.
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        // Guardo la moneda de la cuenta, limitada a las que admito.
        currency: {
            type: String,
            enum: [...CURRENCIES],
            required: true,
        },

        // Guardo el saldo en céntimos, como entero: 12,34 se guarda como 1234.
        balanceCents: {
            type: Number,
            required: true,
            default: 0,
            min: 0,
            validate: {
                validator: Number.isSafeInteger,
                message: "El saldo debe ser un número entero de céntimos.",
            },
        },
    },
    {
        // Dejo que Mongoose gestione las fechas de creación y modificación.
        timestamps: true,
    },
);

// Impido que un usuario tenga dos cuentas de la misma moneda.
accountSchema.index({ user: 1, currency: 1 }, { unique: true });

// Creo y exporto el modelo con el que trabajaré las cuentas.
export const Account = model("Account", accountSchema);