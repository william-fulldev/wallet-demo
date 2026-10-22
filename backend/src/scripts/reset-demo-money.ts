import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import {
    applyDemoMoneyReset,
    previewDemoMoneyReset,
} from "../modules/demo/reset-demo-money.service.js";

function centsToMoney(cents: number, currency: string): string {
    return (cents / 100).toFixed(2) + " " + currency;
}

/**
 * Script de reinicio total del dinero y movimientos de la demo.
 *
 * ALCANCE GLOBAL:
 * Es DELIBERADAMENTE global (afecta a todos los usuarios). En un sistema con transferencias,
 * cada envío genera apuntes en dos usuarios (emisor y receptor). Un reinicio por usuario
 * rompería la simetría contable e histórica.
 *
 * SEGURIDAD:
 * - Modo simulación por defecto (no modifica nada si no se pasa --apply).
 * - Exige escribir el nombre exacto de la base de datos para confirmar en modo --apply.
 * - Rechaza terminantemente ejecutarse contra bases de datos de prueba (*_test).
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

        const preview = await previewDemoMoneyReset();

        console.log("\n=======================================================");
        console.log("       REINICIO TOTAL DEL DINERO DEMO (GLOBAL)");
        console.log("=======================================================");
        console.log(`Base de datos: ${dbName}`);
        console.log(`Usuarios en la base: ${preview.totalUsers}`);
        console.log(`Cuentas existentes: ${preview.totalAccounts}`);
        console.log(`Movimientos a eliminar: ${preview.totalMovements}`);
        console.log(`Transferencias a eliminar: ${preview.totalTransfers}`);
        console.log(`Posiciones (Holdings) a eliminar: ${preview.totalHoldings}`);
        console.log(`Operaciones (Trades) a eliminar: ${preview.totalTrades}`);
        console.log(`Contactos con fecha de transferencia a reiniciar: ${preview.totalContactsWithLastTransferredAt}`);
        console.log("-------------------------------------------------------");

        if (preview.users.length > 0) {
            console.log("\n--- Estado previsto por usuario tras el reinicio ---");
            const tableData = preview.users.map((u) => ({
                Usuario: u.name,
                Email: u.email,
                "EUR actual": centsToMoney(u.currentEurCents, "EUR"),
                "EUR previsto": centsToMoney(u.projectedEurCents, "EUR"),
                "USD actual": centsToMoney(u.currentUsdCents, "USD"),
                "USD previsto": centsToMoney(u.projectedUsdCents, "USD"),
                "BRL actual": centsToMoney(u.currentBrlCents, "BRL"),
                "BRL previsto": centsToMoney(u.projectedBrlCents, "BRL"),
            }));
            console.table(tableData);
        }

        if (!isApply) {
            console.log("\nℹ️  Modo SIMULACIÓN finalizado. No se ha modificado ningún dato.");
            console.log("Para aplicar el reinicio definitivo, ejecuta:");
            console.log("  npm run reset:demo-money -- --apply\n");
            await mongoose.disconnect();
            process.exit(0);
        }

        // Modo --apply: solicitar confirmación explícita escribiendo el nombre de la base de datos
        console.log(`\n⚠️  ATENCIÓN: Se dispone a ejecutar el reinicio real en la base "${dbName}".`);
        console.log("Se eliminarán todos los movimientos, transferencias e inversiones.");
        console.log("Todas las cuentas volverán al estado inicial exacto de 500 EUR, 500 USD y 500 BRL.");
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

        console.log("\nAplicando reinicio atómico del dinero demo...");
        const result = await applyDemoMoneyReset();

        console.log("\n=======================================================");
        console.log("           REINICIO COMPLETADO CON ÉXITO");
        console.log("=======================================================");
        console.log(`Usuarios reiniciados a 500/500/500: ${result.usersReset}`);
        console.log(`Movimientos eliminados: ${result.movementsDeleted}`);
        console.log(`Transferencias eliminadas: ${result.transfersDeleted}`);
        console.log(`Holdings eliminados: ${result.holdingsDeleted}`);
        console.log(`Trades eliminados: ${result.tradesDeleted}`);
        console.log(`Contactos reiniciados: ${result.contactsReset}`);
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
