import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../app.js";
import { Account } from "../../models/account.model.js";
import { Contact } from "../../models/contact.model.js";
import { Holding } from "../../models/holding.model.js";
import { Movement } from "../../models/movement.model.js";
import { Trade } from "../../models/trade.model.js";
import { Transfer } from "../../models/transfer.model.js";
import { User } from "../../models/user.model.js";
import { addContactFor, authHeader, createTestUser, fund, getBalances } from "../../test/helpers.js";
import { DEMO_USERS, demoPassword } from "./demo-users.js";
import { resetDemoGlobal } from "./reset-demo-global.service.js";

describe("restablecimiento global de demo (resetDemoGlobal)", () => {
    it("restablece completamente usuarios demo, contraseñas, saldos a 500/500/500, vacía cartera e inversiones e inserta los 8 gastos", async () => {
        // 1. Crear usuarios y actividad ficticia previa (para simular uso previo en la plataforma)
        const userA = await createTestUser("Usuario Previo A");
        const userB = await createTestUser("Usuario Previo B");
        const contactId = await addContactFor(userA, userB);

        await fund(userA, "EUR", 120_000);
        await fund(userA, "USD", 80_000);

        // Generar transferencia
        await request(app)
            .post("/api/transfers")
            .set(authHeader(userA))
            .set("Idempotency-Key", "global-reset-key-01")
            .send({ contactId, currency: "EUR", amountCents: 20_000 });

        // Generar compra de inversión (Holding + Trade)
        await request(app)
            .post("/api/investments/buy")
            .set(authHeader(userA))
            .set("Idempotency-Key", "global-reset-key-02")
            .send({ symbol: "AAPL", amountCents: 15_000 });

        expect(await Transfer.countDocuments()).toBeGreaterThan(0);
        expect(await Holding.countDocuments()).toBeGreaterThan(0);
        expect(await Trade.countDocuments()).toBeGreaterThan(0);

        // 2. Ejecutar restablecimiento global
        const result = await resetDemoGlobal();

        expect(result.demoUsersRestored).toBe(DEMO_USERS.length);
        expect(result.totalUsersReset).toBeGreaterThanOrEqual(DEMO_USERS.length);
        expect(result.holdingsDeleted).toBeGreaterThanOrEqual(1);
        expect(result.tradesDeleted).toBeGreaterThanOrEqual(1);
        expect(result.transfersDeleted).toBeGreaterThanOrEqual(1);
        expect(result.demoExpensesPerUser).toBe(8);

        // 3. Comprobar que colecciones de operaciones e inversiones quedaron en 0
        expect(await Holding.countDocuments()).toBe(0);
        expect(await Trade.countDocuments()).toBe(0);
        expect(await Transfer.countDocuments()).toBe(0);

        // 4. Comprobar que todos los usuarios demo existen y tienen los saldos canónicos
        for (const demo of DEMO_USERS) {
            const dbUser = await User.findOne({ email: demo.email });
            expect(dbUser).not.toBeNull();
            expect(dbUser?.avatarId).toBe(demo.avatarId);
            expect(dbUser?.name).toBe(demo.name);

            // Verificar inicio de sesión con su contraseña por defecto
            const loginRes = await request(app)
                .post("/api/auth/login")
                .send({ email: demo.email, password: demoPassword(demo) });

            expect(loginRes.status).toBe(200);

            // Verificar saldos exactos: 500 EUR, 500 USD, 500 BRL
            const accounts = await Account.find({ user: dbUser?._id });
            const eur = accounts.find((a) => a.currency === "EUR")?.balanceCents;
            const usd = accounts.find((a) => a.currency === "USD")?.balanceCents;
            const brl = accounts.find((a) => a.currency === "BRL")?.balanceCents;

            expect(eur).toBe(50_000);
            expect(usd).toBe(50_000);
            expect(brl).toBe(50_000);

            // Verificar los 8 gastos demo
            const payments = await Movement.find({ user: dbUser?._id, type: "payment_out" });
            expect(payments).toHaveLength(8);

            // Verificar que los contactos demo existen (debe tener al menos los otros demo)
            const contacts = await Contact.find({ owner: dbUser?._id });
            expect(contacts.length).toBeGreaterThanOrEqual(DEMO_USERS.length - 1);
            for (const c of contacts) {
                expect(c.lastTransferredAt).toBeNull();
            }
        }

        // 5. Idempotencia: una segunda ejecución deja el mismo estado perfecto
        const secondResult = await resetDemoGlobal();
        expect(secondResult.demoUsersRestored).toBe(DEMO_USERS.length);
        expect(await Holding.countDocuments()).toBe(0);
        expect(await Trade.countDocuments()).toBe(0);
        expect(await Transfer.countDocuments()).toBe(0);
    }, 90_000);
});
