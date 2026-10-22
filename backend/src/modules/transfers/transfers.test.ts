import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../app.js";
import {
    addContactFor,
    authHeader,
    createTestUser,
    fund,
    getBalances,
    getMovements,
    type TestUser,
} from "../../test/helpers.js";

function send(user: TestUser, contactId: string, body: object, key: string = randomUUID()) {
    return request(app)
        .post("/api/transfers")
        .set(authHeader(user))
        .set("Idempotency-Key", key)
        .send({ contactId, ...body });
}

describe("POST /api/transfers", () => {
    it("envía dinero: descuenta, acredita y anota un apunte para cada uno", async () => {
        const ana = await createTestUser("Ana");
        const beto = await createTestUser("Beto");
        await fund(ana, "EUR", 10_000);
        const contactId = await addContactFor(ana, beto);

        const response = await send(ana, contactId, { currency: "EUR", amountCents: 2_500, note: "Pizza" });

        expect(response.status).toBe(201);
        expect(response.body.account.balanceCents).toBe(7_500);
        expect(response.body.movement).toMatchObject({
            type: "transfer_out",
            amountCents: 2_500,
            note: "Pizza",
            counterparty: { name: "Beto" },
        });
        expect(await getBalances(ana)).toMatchObject({ EUR: 7_500 });
        expect(await getBalances(beto)).toMatchObject({ EUR: 2_500 });

        const betoMovements = await getMovements(beto);
        expect(betoMovements).toHaveLength(1);
        expect(betoMovements[0]).toMatchObject({
            type: "transfer_in",
            amountCents: 2_500,
            note: "Pizza",
            counterparty: { name: "Ana" },
        });
    });

    it("conserva el dinero: la suma de saldos no cambia con varios envíos", async () => {
        const ana = await createTestUser("Ana");
        const beto = await createTestUser("Beto");
        await fund(ana, "EUR", 10_000);
        await fund(beto, "EUR", 5_000);
        const contactId = await addContactFor(ana, beto);

        for (const amountCents of [1_234, 5, 4_000]) {
            await send(ana, contactId, { currency: "EUR", amountCents });
        }

        const total = (await getBalances(ana)).EUR! + (await getBalances(beto)).EUR!;

        expect(total).toBe(15_000);
    });

    it("rechaza el envío sin saldo suficiente y no cambia nada", async () => {
        const ana = await createTestUser("Ana");
        const beto = await createTestUser("Beto");
        await fund(ana, "EUR", 5_000);
        const contactId = await addContactFor(ana, beto);

        const response = await send(ana, contactId, { currency: "EUR", amountCents: 6_000 });

        expect(response.status).toBe(422);
        expect(await getBalances(ana)).toMatchObject({ EUR: 5_000 });
        expect(await getBalances(beto)).toMatchObject({ EUR: 0 });
        expect(await getMovements(beto)).toHaveLength(0);
        // Solo queda el apunte del ingreso.
        expect(await getMovements(ana)).toHaveLength(1);
    });

    it("no deja usar el contacto de otro usuario", async () => {
        const ana = await createTestUser("Ana");
        const beto = await createTestUser("Beto");
        const carla = await createTestUser("Carla");
        await fund(carla, "EUR", 10_000);
        const anaContact = await addContactFor(ana, beto);

        const response = await send(carla, anaContact, { currency: "EUR", amountCents: 1_000 });

        expect(response.status).toBe(404);
        expect(await getBalances(carla)).toMatchObject({ EUR: 10_000 });
        expect(await getBalances(beto)).toMatchObject({ EUR: 0 });
    });

    it("repetir el mismo envío con la misma clave no lo duplica", async () => {
        const ana = await createTestUser("Ana");
        const beto = await createTestUser("Beto");
        await fund(ana, "EUR", 10_000);
        const contactId = await addContactFor(ana, beto);
        const key = randomUUID();
        const body = { currency: "EUR", amountCents: 2_500 };

        const first = await send(ana, contactId, body, key);
        const second = await send(ana, contactId, body, key);

        expect(first.status).toBe(201);
        expect(second.status).toBe(200);
        expect(second.headers["idempotent-replayed"]).toBe("true");
        expect(second.body.transferId).toBe(first.body.transferId);
        expect(await getBalances(ana)).toMatchObject({ EUR: 7_500 });
        expect(await getBalances(beto)).toMatchObject({ EUR: 2_500 });
        // El ingreso y un único envío.
        expect(await getMovements(ana)).toHaveLength(2);
    });

    it("rechaza reutilizar una clave con datos distintos", async () => {
        const ana = await createTestUser("Ana");
        const beto = await createTestUser("Beto");
        await fund(ana, "EUR", 10_000);
        const contactId = await addContactFor(ana, beto);
        const key = randomUUID();
        await send(ana, contactId, { currency: "EUR", amountCents: 2_500 }, key);

        const response = await send(ana, contactId, { currency: "EUR", amountCents: 3_000 }, key);

        expect(response.status).toBe(422);
        expect(await getBalances(ana)).toMatchObject({ EUR: 7_500 });
    });

    it("con dos envíos simultáneos sobre el mismo saldo solo uno tiene éxito", async () => {
        const ana = await createTestUser("Ana");
        const beto = await createTestUser("Beto");
        await fund(ana, "EUR", 10_000);
        const contactId = await addContactFor(ana, beto);

        const results = await Promise.all([
            send(ana, contactId, { currency: "EUR", amountCents: 6_000 }),
            send(ana, contactId, { currency: "EUR", amountCents: 6_000 }),
        ]);

        const statuses = results.map((result) => result.status).sort((a, b) => a - b);

        expect(statuses).toEqual([201, 422]);
        expect(await getBalances(ana)).toMatchObject({ EUR: 4_000 });
        expect(await getBalances(beto)).toMatchObject({ EUR: 6_000 });
    });

    it("con dos peticiones simultáneas con la misma clave solo se envía una vez", async () => {
        const ana = await createTestUser("Ana");
        const beto = await createTestUser("Beto");
        await fund(ana, "EUR", 10_000);
        const contactId = await addContactFor(ana, beto);
        const key = randomUUID();
        const body = { currency: "EUR", amountCents: 2_500 };

        const results = await Promise.all([
            send(ana, contactId, body, key),
            send(ana, contactId, body, key),
        ]);

        const statuses = results.map((result) => result.status).sort((a, b) => a - b);

        expect(statuses).toEqual([200, 201]);
        expect(await getBalances(ana)).toMatchObject({ EUR: 7_500 });
        expect(await getBalances(beto)).toMatchObject({ EUR: 2_500 });
    });

    it("valida la cabecera y el cuerpo", async () => {
        const ana = await createTestUser("Ana");
        const beto = await createTestUser("Beto");
        await fund(ana, "EUR", 10_000);
        const contactId = await addContactFor(ana, beto);
        const valid = { currency: "EUR", amountCents: 100 };

        const withoutKey = await request(app)
            .post("/api/transfers")
            .set(authHeader(ana))
            .send({ contactId, ...valid });
        const shortKey = await send(ana, contactId, valid, "abc");

        expect(withoutKey.status).toBe(400);
        expect(shortKey.status).toBe(400);

        const invalidBodies = [
            { amountCents: 0 },
            { amountCents: 12.5 },
            { amountCents: "100" },
            { amountCents: 1_000_001 },
            { currency: "XXX" },
            { note: "x".repeat(141) },
            { extra: true },
        ];

        for (const invalid of invalidBodies) {
            expect((await send(ana, contactId, { ...valid, ...invalid })).status).toBe(400);
        }

        expect((await send(ana, "123", valid)).status).toBe(400);
    });

    it("exige autenticación", async () => {
        const response = await request(app)
            .post("/api/transfers")
            .set("Idempotency-Key", randomUUID())
            .send({ contactId: "a".repeat(24), currency: "EUR", amountCents: 100 });

        expect(response.status).toBe(401);
    });
});