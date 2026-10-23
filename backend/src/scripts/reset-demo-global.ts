import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { resetDemoGlobal } from "../modules/demo/reset-demo-global.service.js";

function formatMoney(cents: number, currency: string): string {
    return (cents / 100).toFixed(2) + " " + currency;
}

async function run() {
    const isAutoConfirm =
        process.argv.some((arg) => /^(-y|--yes|-f|--force|yes)$/i.test(arg.trim())) ||
        process.env.RESET_YES === "true" ||
        process.env.CI === "true";

    try {
        console.log("\n=======================================================");
        console.log("   RESTABLECIMIENTO GLOBAL DE DEMO (WALLET & INVERSIONES)");
        console.log("=======================================================");

        await mongoose.connect(env.mongodbUri);
        const dbName = mongoose.connection.name;

        console.log(`Conectado a la base de datos: ${dbName}`);

        if (dbName.endsWith("_test")) {
            console.error(`\n❌ Error: Se rechaza terminantemente ejecutar el restablecimiento en la base de datos de pruebas "${dbName}".`);
            await mongoose.disconnect();
            process.exit(1);
        }

        if (!isAutoConfirm) {
            console.log("\n⚠️  Esta acción restablecerá:");
            console.log("  • Saldos a 500,00 EUR, 500,00 USD y 500,00 BRL en todos los usuarios.");
            console.log("  • 8 gastos de ejemplo en EUR (Netflix, Spotify, Starbucks, etc.).");
            console.log("  • Vaciado de cartera de inversiones (0 holdings) y 0 operaciones.");
            console.log("  • Eliminación de transferencias previas y restablecimiento de contactos.");
            console.log("  • Restauración de credenciales predefinidas de los 10 usuarios demo.\n");

            const rl = readline.createInterface({ input, output });
            const answer = await rl.question(
                `¿Deseas restablecer todos los valores predefinidos en "${dbName}"? (s/N): `,
            );
            rl.close();

            if (answer.trim().toLowerCase() !== "s" && answer.trim().toLowerCase() !== "si" && answer.trim().toLowerCase() !== "y" && answer.trim().toLowerCase() !== "yes") {
                console.log("\nOperación cancelada por el usuario. No se ha modificado ningún dato.");
                await mongoose.disconnect();
                process.exit(0);
            }
        }

        console.log("\nAplicando restablecimiento atómico...");
        const start = Date.now();
        const result = await resetDemoGlobal();
        const elapsed = ((Date.now() - start) / 1000).toFixed(2);

        console.log("\n=======================================================");
        console.log(`   ✅ RESTABLECIMIENTO COMPLETADO CON ÉXITO (${elapsed}s)`);
        console.log("=======================================================");
        console.log(`• Base de datos:                  ${dbName}`);
        console.log(`• Usuarios demo restablecidos:    ${result.demoUsersRestored}`);
        console.log(`• Total usuarios reseteados:      ${result.totalUsersReset}`);
        console.log(`• Cuentas actualizadas:           ${result.accountsReset}`);
        console.log(`• Movimientos previos eliminados: ${result.movementsDeleted}`);
        console.log(`• Transferencias eliminadas:      ${result.transfersDeleted}`);
        console.log(`• Posiciones de cartera borradas: ${result.holdingsDeleted}`);
        console.log(`• Operaciones de bolsa borradas:  ${result.tradesDeleted}`);
        console.log(`• Sesiones/Tokens revocados:      ${result.refreshTokensDeleted}`);
        console.log(`• Contactos restablecidos:        ${result.contactsReset}`);
        console.log(`• Gastos demo por usuario:        ${result.demoExpensesPerUser}`);
        console.log("-------------------------------------------------------");

        console.log("\n--- Estado final de los 9 usuarios de demostración ---");
        const tableData = result.usersSummary.map((u) => ({
            "Nº": u.demoNumber,
            Usuario: u.name,
            Avatar: u.avatarId,
            Correo: u.email,
            Contraseña: u.passwordDefault,
            EUR: formatMoney(u.eurCents, "EUR"),
            USD: formatMoney(u.usdCents, "USD"),
            BRL: formatMoney(u.brlCents, "BRL"),
            Gastos: u.paymentsCount,
            Cartera: `${u.holdingsCount} activos`,
        }));
        console.table(tableData);

        console.log("=======================================================");
        console.log("La base de datos está lista con sus valores predefinidos.");
        console.log("Ahora puedes sincronizar tu repositorio con Git; Vercel");
        console.log("y Render reflejarán este estado inmediatamente.");
        console.log("=======================================================\n");

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error("\n❌ Error durante el restablecimiento:", error);
        await mongoose.disconnect().catch(() => {});
        process.exit(1);
    }
}

void run();
