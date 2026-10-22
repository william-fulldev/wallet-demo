import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import {
    applyInvestmentReset,
    previewInvestmentReset,
} from "../modules/demo/reset-investments.service.js";

function centsToMoney(cents: number): string {
    return (cents / 100).toFixed(2) + " USD";
}

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

        const preview = await previewInvestmentReset();

        if (preview.affectedUsers.length === 0) {
            console.log("No se encontraron usuarios con inversiones ni compras de prueba.");
            await mongoose.disconnect();
            process.exit(0);
        }

        console.log("\n--- Usuarios con compras de inversiones ---");
        const tableData = preview.affectedUsers.map((u) => ({
            Usuario: u.name,
            Email: u.email,
            Holdings: u.holdingsCount,
            Trades: u.tradesCount,
            Compras: u.investmentBuysCount,
            Ventas: u.investmentSellsCount,
            "Saldo USD actual": centsToMoney(u.currentUsdBalanceCents),
            "Saldo USD tras reset": centsToMoney(u.projectedUsdBalanceCents),
        }));
        console.table(tableData);

        console.log(`Total usuarios afectados: ${preview.affectedUsers.length}`);
        console.log(`Total Holdings a borrar: ${preview.totalHoldings}`);
        console.log(`Total Trades a borrar: ${preview.totalTrades}`);
        console.log(`Total apuntes investment_buy a borrar: ${preview.totalInvestmentBuys}`);
        console.log(`Total apuntes investment_sell a borrar: ${preview.totalInvestmentSells}\n`);

        if (!isApply) {
            console.log("Modo SIMULACIÓN finalizado. No se ha modificado ningún dato.");
            console.log("Para aplicar los cambios reales, ejecuta:");
            console.log("npm run reset:demo-investments -- --apply\n");
            await mongoose.disconnect();
            process.exit(0);
        }

        // Modo --apply: solicitar confirmación explícita escribiendo el nombre de la base de datos
        console.log(`⚠️ ATENCIÓN: Se dispone a ejecutar la limpieza real en la base "${dbName}".`);
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

        console.log("\nAplicando limpieza de inversiones en transacciones por usuario...");
        const result = await applyInvestmentReset();

        console.log("\n--- Resumen de Limpieza Aplicada ---");
        console.log(`Usuarios procesados: ${result.usersProcessed.length}`);
        if (result.usersAborted.length > 0) {
            console.log(`⚠️ Usuarios abortados por saldo negativo: ${result.usersAborted.length}`);
            for (const aborted of result.usersAborted) {
                console.log(`  - ${aborted.email}: ${aborted.reason}`);
            }
        }
        console.log(`Holdings eliminados: ${result.totalHoldingsDeleted}`);
        console.log(`Trades eliminados: ${result.totalTradesDeleted}`);
        console.log(`Apuntes investment_buy eliminados: ${result.totalInvestmentBuysDeleted}`);
        console.log(`Apuntes investment_sell eliminados: ${result.totalInvestmentSellsDeleted}`);
        console.log("Saldos y cadenas de cuentas USD recalculados satisfactoriamente.");
        console.log("-------------------------------------\n");

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error("Error durante la ejecución del script:", error);
        await mongoose.disconnect().catch(() => {});
        process.exit(1);
    }
}

void run();
