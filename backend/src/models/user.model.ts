import { Schema, model } from "mongoose";

// Defino los campos y las reglas de los usuarios de mi wallet.
const userSchema = new Schema(
    {
        // Guardo el nombre que mostraré en la interfaz.
        name: {
            type: String,
            required: true,
            trim: true,
            minLength: 2,
            maxLength: 80,
        },

        // Normalizo el correo y solicito un índice que impida duplicados.
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            unique: true,
        },

        // Guardo el hash, nunca la contraseña original.
        passwordHash: {
            type: String,
            required: true,
            select: false,
        },

        // Identificador del retrato, por ejemplo "avatar-03". null hasta que haya uno asignado.
        avatarId: {
            type: String,
            match: /^avatar-\d{2}$/,
            default: null,
        },
    },
    {
        // Dejo que Mongoose gestione las fechas de creación y modificación.
        timestamps: true,
    },
);

// Creo y exporto el modelo con el que trabajaré los usuarios.
export const User = model("User", userSchema);
