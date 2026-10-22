import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import {
    applyMigrateDemoUsers,
    previewMigrateDemoUsers,
} from "../modules/demo/migrate-demo-users.service.js";

/**
 * Script de migración de usuarios de demostración a nuevos correos y contraseñas.
 *
 * SEGURIDAD:
 * - Modo simulación por defecto (no escribe nada si no se pasa --apply).
 * - Exige escribir el nombre exacto de la base de datos para confirmar en modo --apply.
 * - Rechaza terminantemente ejecutarse contra bases de datos de prueba (*_test).
 * - Nunca expone contraseñas ni hashes en logs ni en la consola.
 */
async function run() {
    const isApply = process.argv.includes("--apply");

    try {
        await mongoose.connect(env.mongodbUri);
        const dbName = mongoose.connection.name;

        console.log(`Conectado a la base de datos: ${dbName}`);

        if (dbName.endsWith("_test")) {
            console.error(`Error: Se rechaza ejecutar este script en la base de datos de pruebas "${dbName}".`);
            await mongoose.disconnect();
            process.exit(1);
        }

        const preview = await previewMigrateDemoUsers();

        console.log("\n=======================================================");
        console.log("       MIGRACIÓN DE USUARIOS DEMO (GMAIL / PASSWORDS)");
        console.log("=======================================================");
        console.log(`Base de datos: ${dbName}`);
        console.log(`Total usuarios de demostración: ${preview.totalUsers}`);
        console.log(`Pendientes de migrar: ${preview.migrated}`);
        console.log(`Ya migrados previamente: ${preview.alreadyMigrated}`);
        console.log(`Conflictos detectados: ${preview.conflicts}`);
        console.log(`No encontrados en la base: ${preview.notFound}`);
        console.log("-------------------------------------------------------");

        if (preview.items.length > 0) {
            console.log("\n--- Estado previsto por usuario ---");
            const tableData = preview.items.map((item) => ({
                Handle: item.handle,
                Usuario: item.name,
                "Correo anterior": item.legacyEmail,
                "Correo nuevo": item.newEmail,
                "¿Cambia contraseña?": item.passwordWillChange ? "Sí" : "No",
                Estado: item.status,
                Detalles: item.details ?? "",
            }));
            console.table(tableData);
        }

        if (!isApply) {
            console.log("\nℹ️  Modo SIMULACIÓN finalizado. No se ha modificado ningún dato.");
            console.log("Para aplicar la migración definitiva, ejecuta:");
            console.log("  npm run migrate:demo-users -- --apply\n");
            await mongoose.disconnect();
            process.exit(0);
        }

        // Modo --apply: solicitar confirmación explícita escribiendo el nombre de la base de datos
        console.log(`\n⚠️  ATENCIÓN: Se dispone a ejecutar la migración real en la base "${dbName}".`);
        console.log("Se actualizarán los correos (@gmail.com) y las contraseñas de los usuarios demo.");
        console.log("Las sesiones activas de los usuarios cuya contraseña cambie serán revocadas.");
        const rl = readline.createInterface({ input, output });
        const answer = await rl.question(
            `Escribe el nombre de la base de datos ("${dbName}") para confirmar: `,
        );
        rl.close();

        if (answer.trim() !== dbName) {
            console.log("Confirmación cancelada (el nombre no coincide). No se ha modificado ningún dato.");
            await mongoose.disconnect();
            process.exit(0);
        }

        console.log("\nAplicando migración de usuarios demo...");
        const result = await applyMigrateDemoUsers();

        console.log("\n=======================================================");
        console.log("           MIGRACIÓN COMPLETADA");
        console.log("=======================================================");
        console.log(`Usuarios migrados: ${result.migrated}`);
        console.log(`Ya migrados previamente: ${result.alreadyMigrated}`);
        console.log(`Conflictos: ${result.conflicts}`);
        console.log(`No encontrados: ${result.notFound}`);
        console.log("-------------------------------------------------------");

        const resultTable = result.items.map((item) => ({
            Handle: item.handle,
            Usuario: item.name,
            "Correo actual": item.newEmail,
            "¿Contraseña actualizada?": item.passwordWillChange ? "Sí" : "No",
            Estado: item.status,
            Detalles: item.details ?? "",
        }));
        console.table(resultTable);
        console.log("=======================================================\n");

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error("Error durante la ejecución del script:", error);
        await mongoose.disconnect().catch(() => {});
        process.exit(1);
    }
}

void run();
