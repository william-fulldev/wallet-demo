import mongoose from "mongoose";

// Importo mi configuración ya validada, incluida la dirección de MongoDB.
import { env } from "./env.js";

// Creo una función para conectar con la base de datos cuando yo decida.
// Es "async" porque conectar con Atlas lleva tiempo y debo esperar la respuesta.
export async function connectDatabase(): Promise<void> {
  // Intento conectarme con mi dirección de Atlas.
  // Si el clúster no responde en 5 segundos, abandono en lugar de esperar al límite por defecto.
    await mongoose.connect(env.mongodbUri, {
        serverSelectionTimeoutMS: 5000,
    });

  // Muestro solo el nombre de la base, nunca la dirección, porque contiene mi contraseña.
    console.log(`Conectado a MongoDB (base: ${mongoose.connection.name})`);
}