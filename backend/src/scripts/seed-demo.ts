import mongoose from "mongoose";
import { env } from "../config/env.js";
import { linkAllUsersToDemoContacts, seedDemoUsers } from "../modules/demo/demo.service.js";

async function run() {
    try {
        await mongoose.connect(env.mongodbUri);
        const dbName = mongoose.connection.name;

        console.log(`Conectado a la base de datos: ${dbName}`);

        if (dbName.endsWith("_test")) {
            console.error(`Error: Se rechaza ejecutar seed:demo en la base de datos de pruebas "${dbName}".`);
            await mongoose.disconnect();
            process.exit(1);
        }

        const usersRes = await seedDemoUsers();
        const contactsRes = await linkAllUsersToDemoContacts();

        console.log("--- Resumen de Seed Demo ---");
        console.log(`Usuarios creados: ${usersRes.usersCreated}`);
        console.log(`Usuarios ya existentes: ${usersRes.usersExisting}`);
        console.log(`Contactos creados: ${contactsRes.totalContactsCreated}`);
        console.log(`Contactos ya existentes: ${contactsRes.totalContactsExisting}`);
        console.log(`Actividades creadas (gastos/ingresos): ${contactsRes.totalActivitiesSeeded}`);
        console.log("----------------------------");

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error("Error durante la ejecución del seed demo:", error);
        await mongoose.disconnect().catch(() => {});
        process.exit(1);
    }
}

void run();
