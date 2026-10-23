import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../../app.js";
import { env } from "../../config/env.js";
import { Account } from "../../models/account.model.js";
import { Contact } from "../../models/contact.model.js";
import { Movement } from "../../models/movement.model.js";
import { User } from "../../models/user.model.js";
import { authHeader, createTestUser } from "../../test/helpers.js";
import { verifyPassword } from "../../utils/password.js";
import { registerUser } from "../auth/auth.service.js";
import { DEMO_USERS, demoPassword } from "./demo-users.js";
import {
    ensureDemoContacts,
    linkAllUsersToDemoContacts,
    seedDemoActivity,
    seedDemoUsers,
} from "./demo.service.js";

describe("módulo demo", () => {
    const originalDemoMode = env.DEMO_MODE;

    afterEach(() => {
        env.DEMO_MODE = originalDemoMode;
    });

    it("seedDemoUsers crea los 10 usuarios con los correos nuevos y sus contraseñas individuales, y cuentas a cero", async () => {
        const result = await seedDemoUsers();

        expect(result.usersCreated).toBe(DEMO_USERS.length);
        expect(result.usersExisting).toBe(0);
        expect(DEMO_USERS).toHaveLength(10);

        for (const demo of DEMO_USERS) {
            const user = await User.findOne({ email: demo.email }).select("+passwordHash");
            expect(user).not.toBeNull();
            expect(user?.name).toBe(demo.name);
            expect(user?.avatarId).toBe(demo.avatarId);
            expect(user?.email).toMatch(/^[a-z]+(\.[a-z]+)*\.demo@gmail\.com$/);

            // Verifica que la contraseña guardada coincide con demoPassword(demo)
            const passwordMatches = await verifyPassword(demoPassword(demo), user!.passwordHash);
            expect(passwordMatches).toBe(true);

            const accounts = await Account.find({ user: user!._id });
            expect(accounts).toHaveLength(3);

            // La financiación se unifica en seedDemoActivity: aquí las cuentas parten de 0
            for (const acc of accounts) {
                expect(acc.balanceCents).toBe(0);
            }
        }
    });

    it("ejecutar seedDemoUsers dos veces no duplica usuarios ni contactos", async () => {
        await seedDemoUsers();
        const secondRun = await seedDemoUsers();

        expect(secondRun.usersCreated).toBe(0);
        expect(secondRun.usersExisting).toBe(DEMO_USERS.length);

        const totalUsers = await User.countDocuments({
            email: { $in: DEMO_USERS.map((d) => d.email) },
        });
        expect(totalUsers).toBe(DEMO_USERS.length);

        for (const demo of DEMO_USERS) {
            const user = await User.findOne({ email: demo.email });
            const accounts = await Account.find({ user: user!._id });
            for (const acc of accounts) {
                expect(acc.balanceCents).toBe(0);
            }
        }
    });

    it("login por HTTP: al menos 3 usuarios inician sesión con su correo y contraseña, contraseña cruzada falla y correo antiguo no existe", async () => {
        await seedDemoUsers();

        const user101 = DEMO_USERS.find((u) => u.demoNumber === 101)!;
        const user104 = DEMO_USERS.find((u) => u.demoNumber === 104)!;
        const user109 = DEMO_USERS.find((u) => u.demoNumber === 109)!;
        const user110 = DEMO_USERS.find((u) => u.demoNumber === 110)!;

        expect(user101).toBeDefined();
        expect(user104).toBeDefined();
        expect(user109).toBeDefined();
        expect(user110).toBeDefined();

        // 1. Login exitoso usuario 101 (Alana R.)
        const res101 = await request(app)
            .post("/api/auth/login")
            .send({ email: user101.email, password: demoPassword(user101) });
        expect(res101.status).toBe(200);
        expect(res101.body.user.email).toBe("alana.demo@gmail.com");
        expect(res101.body.user.name).toBe("Alana R.");
        expect(res101.body).toHaveProperty("accessToken");
        expect(res101.body).toHaveProperty("refreshToken");

        // 2. Login exitoso usuario 104 (Thaís G.)
        const res104 = await request(app)
            .post("/api/auth/login")
            .send({ email: user104.email, password: demoPassword(user104) });
        expect(res104.status).toBe(200);
        expect(res104.body.user.email).toBe("thais.demo@gmail.com");
        expect(res104.body.user.name).toBe("Thaís G.");

        // 3. Login exitoso usuario 109 (Laura B.)
        const res109 = await request(app)
            .post("/api/auth/login")
            .send({ email: user109.email, password: demoPassword(user109) });
        expect(res109.status).toBe(200);
        expect(res109.body.user.email).toBe("laura.demo@gmail.com");
        expect(res109.body.user.name).toBe("Laura B.");

        // 4. Login exitoso usuario 110 (Griffin A.)
        const res110 = await request(app)
            .post("/api/auth/login")
            .send({ email: user110.email, password: demoPassword(user110) });
        expect(res110.status).toBe(200);
        expect(res110.body.user.email).toBe("griffin.demo@gmail.com");
        expect(res110.body.user.name).toBe("Griffin A.");

        // 5. Usuario 101 con la contraseña de otro usuario (User 102) recibe error 401
        const user102 = DEMO_USERS.find((u) => u.demoNumber === 102)!;
        const resCrossPassword = await request(app)
            .post("/api/auth/login")
            .send({ email: user101.email, password: demoPassword(user102) });
        expect(resCrossPassword.status).toBe(401);

        // 5. El correo antiguo ya no existe (401)
        const resOldEmail = await request(app)
            .post("/api/auth/login")
            .send({ email: "alana.demo@wallet.demo", password: demoPassword(user101) });
        expect(resOldEmail.status).toBe(401);
    });

    it("ensureDemoContacts da todos los contactos demo a un usuario normal y N-1 a uno de demostración", async () => {
        await seedDemoUsers();

        const normalUser = await createTestUser("Usuario Normal");
        const resNormal = await ensureDemoContacts(normalUser.id);
        expect(resNormal.contactsCreated).toBe(DEMO_USERS.length);

        const normalContacts = await Contact.find({ owner: normalUser.id });
        expect(normalContacts).toHaveLength(DEMO_USERS.length);

        const demoUser = await User.findOne({ email: DEMO_USERS[0].email });
        expect(demoUser).not.toBeNull();

        const resDemo = await ensureDemoContacts(demoUser!.id);
        expect(resDemo.contactsCreated).toBe(DEMO_USERS.length - 1);

        const demoContacts = await Contact.find({ owner: demoUser!._id });
        expect(demoContacts).toHaveLength(DEMO_USERS.length - 1);
        expect(demoContacts.some((c) => c.user.toString() === demoUser!.id)).toBe(false);
    });

    it("linkAllUsersToDemoContacts da contactos a usuarios creados antes del seed", async () => {
        const preUser = await createTestUser("Usuario Previo");
        expect(await Contact.countDocuments({ owner: preUser.id })).toBe(0);

        await seedDemoUsers();
        await linkAllUsersToDemoContacts();

        const contacts = await Contact.find({ owner: preUser.id });
        expect(contacts).toHaveLength(DEMO_USERS.length);
    });

    it("registro con DEMO_MODE activado asigna los contactos y desactivado 0", async () => {
        await seedDemoUsers();

        env.DEMO_MODE = false;
        const userNoDemo = await registerUser({
            name: "Sin Modo Demo",
            email: "sin.demo@example.com",
            password: "Password123!",
        });
        expect(await Contact.countDocuments({ owner: userNoDemo.id })).toBe(0);

        env.DEMO_MODE = true;
        const userWithDemo = await registerUser({
            name: "Con Modo Demo",
            email: "con.demo@example.com",
            password: "Password123!",
        });
        expect(await Contact.countDocuments({ owner: userWithDemo.id })).toBe(DEMO_USERS.length);
    });

    it("GET /api/contacts devuelve nombre y avatarId pero NUNCA el correo", async () => {
        await seedDemoUsers();
        const user = await createTestUser("Observador Contactos");
        await ensureDemoContacts(user.id);

        const response = await request(app).get("/api/contacts").set(authHeader(user));

        expect(response.status).toBe(200);
        expect(response.body.contacts).toHaveLength(DEMO_USERS.length);

        const bodyString = JSON.stringify(response.body);

        for (const demo of DEMO_USERS) {
            expect(bodyString).not.toContain(demo.email);
        }

        for (const contact of response.body.contacts) {
            expect(contact).toHaveProperty("id");
            expect(contact).toHaveProperty("name");
            expect(contact).toHaveProperty("avatarId");
            expect(contact.avatarId).toMatch(/^avatar-\d{2}$/);
        }
    });

    it("seedDemoActivity crea los apuntes esperados, es idempotente, los saldos nunca son negativos y deja exactamente 500 EUR, 500 USD y 500 BRL", async () => {
        const user = await createTestUser("Usuario Actividad Demo");

        // Primera ejecución
        const firstRun = await seedDemoActivity(user.id);
        expect(firstRun.executed).toBe(true);
        expect(firstRun.paymentsCreated).toBe(8);

        // Verificación de movimientos creados: 8 pagos en EUR y 3 ingresos iniciales (EUR, USD, BRL)
        const payments = await Movement.find({ user: user.id, type: "payment_out" }).sort({ createdAt: 1 });
        expect(payments).toHaveLength(8);

        const deposits = await Movement.find({ user: user.id, type: "deposit" });
        expect(deposits).toHaveLength(3); // 1 en EUR (622,32), 1 en USD (500,00) y 1 en BRL (500,00)

        // Comprobación de que ningún saldo quedó negativo
        const allMovements = await Movement.find({ user: user.id }).sort({ createdAt: 1 });
        for (const m of allMovements) {
            expect(m.balanceAfterCents).toBeGreaterThanOrEqual(0);
        }

        // Saldos finales exactos de 500,00 (50_000 céntimos) en las tres cuentas
        const eurAccount = await Account.findOne({ user: user.id, currency: "EUR" });
        const usdAccount = await Account.findOne({ user: user.id, currency: "USD" });
        const brlAccount = await Account.findOne({ user: user.id, currency: "BRL" });

        expect(eurAccount?.balanceCents).toBe(50_000); // 500,00 EUR exactos tras los 8 gastos
        expect(usdAccount?.balanceCents).toBe(50_000); // 500,00 USD exactos
        expect(brlAccount?.balanceCents).toBe(50_000); // 500,00 BRL exactos

        // Cadena de coherencia en EUR: el saldo final coincide con el último balanceAfterCents
        const lastEurMovement = await Movement.findOne({ user: user.id, currency: "EUR" }).sort({ createdAt: -1, _id: -1 });
        expect(eurAccount?.balanceCents).toBe(lastEurMovement?.balanceAfterCents);

        // Fechas estrictamente crecientes
        for (let i = 1; i < allMovements.length; i++) {
            expect(allMovements[i].createdAt.getTime()).toBeGreaterThan(allMovements[i - 1].createdAt.getTime());
        }

        // Segunda ejecución: debe ser idempotente y no crear nada nuevo
        const secondRun = await seedDemoActivity(user.id);
        expect(secondRun.executed).toBe(false);
        expect(secondRun.paymentsCreated).toBe(0);

        const movementsAfter = await Movement.countDocuments({ user: user.id });
        expect(movementsAfter).toBe(allMovements.length);

        const eurAccountAfter = await Account.findOne({ user: user.id, currency: "EUR" });
        const usdAccountAfter = await Account.findOne({ user: user.id, currency: "USD" });
        const brlAccountAfter = await Account.findOne({ user: user.id, currency: "BRL" });

        expect(eurAccountAfter?.balanceCents).toBe(50_000);
        expect(usdAccountAfter?.balanceCents).toBe(50_000);
        expect(brlAccountAfter?.balanceCents).toBe(50_000);
    });
});
