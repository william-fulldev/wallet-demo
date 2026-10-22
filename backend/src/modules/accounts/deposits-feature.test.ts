import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../../app.js";
import { env } from "../../config/env.js";
import { Account } from "../../models/account.model.js";
import { Movement } from "../../models/movement.model.js";
import { authHeader, createTestUser, fund, getBalances, addContactFor } from "../../test/helpers.js";

describe("interruptor de ingresos y endpoints de dinero", () => {
    afterEach(() => {
        // Asegurar que vuelve al valor habilitado en el entorno de pruebas
        env.DEPOSITS_ENABLED = true;
    });

    it("GET /api/config/features devuelve depositsEnabled sin autenticación ni campos extra", async () => {
        env.DEPOSITS_ENABLED = false;
        const resOff = await request(app).get("/api/config/features");
        expect(resOff.status).toBe(200);
        expect(resOff.body).toEqual({ depositsEnabled: false });

        env.DEPOSITS_ENABLED = true;
        const resOn = await request(app).get("/api/config/features");
        expect(resOn.status).toBe(200);
        expect(resOn.body).toEqual({ depositsEnabled: true });
    });

    it("con DEPOSITS_ENABLED=false, la ruta de ingresos responde 403 con código estable y no toca saldos", async () => {
        env.DEPOSITS_ENABLED = false;
        const user = await createTestUser("Usuario Depósito Bloqueado");

        const balancesBefore = await getBalances(user);
        const movementsBefore = await Movement.countDocuments({ user: user.id });

        // Petición con cuerpo válido
        const resValid = await request(app)
            .post("/api/accounts/EUR/deposit")
            .set(authHeader(user))
            .send({ amountCents: 5000 });

        expect(resValid.status).toBe(403);
        expect(resValid.body).toEqual({
            code: "DEPOSITS_DISABLED",
            message: "Los ingresos están desactivados en esta demo. Cada cuenta parte con 500 EUR, 500 USD y 500 BRL.",
        });

        // No se salta el bloqueo con cuerpo inválido
        const resInvalid = await request(app)
            .post("/api/accounts/EUR/deposit")
            .set(authHeader(user))
            .send({ amountCents: -100 });

        expect(resInvalid.status).toBe(403);
        expect(resInvalid.body.code).toBe("DEPOSITS_DISABLED");

        // No se salta el bloqueo con cuerpo vacío
        const resEmpty = await request(app)
            .post("/api/accounts/EUR/deposit")
            .set(authHeader(user))
            .send({});

        expect(resEmpty.status).toBe(403);
        expect(resEmpty.body.code).toBe("DEPOSITS_DISABLED");

        // Comprobación de que no se modificaron saldos ni se crearon apuntes
        const balancesAfter = await getBalances(user);
        expect(balancesAfter).toEqual(balancesBefore);

        const movementsAfter = await Movement.countDocuments({ user: user.id });
        expect(movementsAfter).toBe(movementsBefore);
    });

    it("con DEPOSITS_ENABLED=true, el ingreso funciona como antes", async () => {
        env.DEPOSITS_ENABLED = true;
        const user = await createTestUser("Usuario Depósito Permitido");

        const response = await request(app)
            .post("/api/accounts/EUR/deposit")
            .set(authHeader(user))
            .send({ amountCents: 15_000 });

        expect(response.status).toBe(201);
        expect(response.body.account.balanceCents).toBe(15_000);
        expect(response.body.movement.type).toBe("deposit");
        expect(response.body.movement.amountCents).toBe(15_000);

        const balances = await getBalances(user);
        expect(balances.EUR).toBe(15_000);
    });

    it("invariante de conservación: ningún endpoint crea dinero de la nada salvo el ingreso", async () => {
        // En este test verificamos que cambio, envío y compra solo descuentan o transfieren saldo existente
        env.DEPOSITS_ENABLED = true;
        const alice = await createTestUser("Alice Invariante");
        const bob = await createTestUser("Bob Invariante");

        await fund(alice, "EUR", 100_000); // 1.000,00 EUR
        await fund(alice, "USD", 50_000);  // 500,00 USD
        await fund(bob, "USD", 10_000);    // 100,00 USD

        const contactId = await addContactFor(alice, bob);

        // 1. Cambio de EUR a USD por parte de Alice (gasta EUR, recibe USD al tipo de cambio)
        const eurChangeAmount = 20_000; // 200,00 EUR
        const exchRes = await request(app)
            .post("/api/accounts/exchange")
            .set(authHeader(alice))
            .send({ from: "EUR", to: "USD", amountCents: eurChangeAmount });
        expect(exchRes.status).toBe(201);
        const usdReceived = exchRes.body.bought.movement.amountCents;

        // Comprobación de que EUR se redujo exactamente por eurChangeAmount
        const aliceEurAfterExch = (await getBalances(alice)).EUR;
        expect(aliceEurAfterExch).toBe(100_000 - eurChangeAmount);

        // 2. Transferencia de USD de Alice a Bob
        const sendUsdAmount = 15_000;
        const transferRes = await request(app)
            .post("/api/transfers")
            .set(authHeader(alice))
            .set("Idempotency-Key", "inv-transfer-key-01")
            .send({ contactId, currency: "USD", amountCents: sendUsdAmount });
        expect(transferRes.status).toBe(201);

        // La suma de USD entre Alice y Bob debe ser exactamente la que había antes de la transferencia
        const aliceUsdAfterSend = (await getBalances(alice)).USD;
        const bobUsdAfterSend = (await getBalances(bob)).USD;
        expect(aliceUsdAfterSend + bobUsdAfterSend).toBe(50_000 + usdReceived + 10_000);

        // 3. Compra de activos en USD por parte de Alice
        const buyAmount = 10_000;
        const buyRes = await request(app)
            .post("/api/investments/buy")
            .set(authHeader(alice))
            .set("Idempotency-Key", "inv-buy-key-01")
            .send({ symbol: "AAPL", amountCents: buyAmount });
        expect(buyRes.status).toBe(201);

        // El saldo USD de Alice se reduce exactamente en buyAmount
        const aliceUsdFinal = (await getBalances(alice)).USD;
        expect(aliceUsdFinal).toBe(aliceUsdAfterSend - buyAmount);
    });
});
