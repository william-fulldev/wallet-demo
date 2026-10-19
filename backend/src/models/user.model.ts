import { Schema, model } from "mongoose";

// Defino los campos y las reglas de los usuarios de mi wallet.
const userSchema = new Schema({
    // Guardo el nombre que mostraré en la interfaz.
    name: {
        type: String,
        required: true,
        trim: true,
        minLength: 2,
        maxLength: 80,
    },

    // Normalizo el correo y solicito un ídice que impida duplicados.
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        unique: true,
    },

    // Guardo el hash, nunca la contraseña original.
    // Excluyo este campo de las consultas normales.
    passwordHash: {
        type: String,
        required: true,
        select: false,
    },
},
{
    // Dejo que Mongoose gestione las fechas de creación y modificación.
    timestamps: true,
},
);

// Creo y exporto el modelo con el que trabajaré los usuarios.
export const User = model("User", userSchema);
