import { Schema, model } from "mongoose";

const contactSchema = new Schema(
    {
        // Quién guarda el contacto.
        owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
        // A qué usuario apunta. No copio su nombre: se consulta al listar y siempre está al día.
        user: { type: Schema.Types.ObjectId, ref: "User", required: true },
        // Fecha de la última transferencia realizada a este contacto (null si no ha habido).
        lastTransferredAt: { type: Date, default: null },
    },
    { timestamps: { createdAt: true, updatedAt: false } },
);

// Un usuario no puede guardar dos veces al mismo contacto.
contactSchema.index({ owner: 1, user: 1 }, { unique: true });

// Índice para listar contactos del dueño ordenados por lastTransferredAt desc y _id asc.
contactSchema.index({ owner: 1, lastTransferredAt: -1, _id: 1 });

export const Contact = model("Contact", contactSchema);
