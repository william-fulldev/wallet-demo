import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach } from "vitest";
import "../models/account.model.js";
import "../models/contact.model.js";
import "../models/holding.model.js";
import "../models/movement.model.js";
import "../models/refresh-token.model.js";
import "../models/trade.model.js";
import "../models/transfer.model.js";
import "../models/user.model.js";

// Cargo las variables de prueba antes de que cualquier módulo lea process.env.
// Si el archivo no existe, lanza un error claro en lugar de usar el .env de desarrollo.
process.loadEnvFile(".env.test");

// En pruebas, los ingresos están habilitados por defecto para que los tests existentes sigan funcionando.
process.env.DEPOSITS_ENABLED = process.env.DEPOSITS_ENABLED ?? "true";

beforeAll(async () => {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
        throw new Error("Falta MONGODB_URI en .env.test.");
    }

    await mongoose.connect(uri);

    // Última defensa: nunca borro datos de una base que no sea de pruebas.
    if (!mongoose.connection.name.endsWith("_test")) {
        const name = mongoose.connection.name;
        await mongoose.disconnect();
        throw new Error(`Rechazo ejecutar pruebas sobre "${name}": el nombre debe terminar en _test.`);
    }

    // Construyo los índices antes de empezar: los únicos son parte del comportamiento.
    await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
});

// Cada prueba parte de una base vacía. Vacío las colecciones y conservo sus índices.
beforeEach(async () => {
    // Restablezco el valor por defecto de DEPOSITS_ENABLED por si alguna prueba lo alteró.
    const { env } = await import("../config/env.js");
    env.DEPOSITS_ENABLED = true;

    const db = mongoose.connection.db;

    if (!db) {
        throw new Error("No hay conexión con la base de pruebas.");
    }

    const collections = await db.collections();
    await Promise.all(collections.map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
    await mongoose.disconnect();
});