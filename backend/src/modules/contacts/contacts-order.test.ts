import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { app } from "../../app.js";
import { Contact } from "../../models/contact.model.js";
import { Movement } from "../../models/movement.model.js";
import {
    addContactFor,
    authHeader,
    createTestUser,
    fund,
    type TestUser,
} from "../../test/helpers.js";

function send(user: TestUser, contactId: string, body: object, key: string = randomUUID()) {
    return request(app)
        .post("/api/transfers")
        .set(authHeader(user))
        .set("Idempotency-Key", key)
        .send({ contactId, ...body });
}

function listContacts(user: TestUser) {
    return request(app).get("/api/contacts").set(authHeader(user));
}

describe("orden de contactos y lastTransferredAt", () => {
    it("contactos sin fecha: orden inicial determinista (_id ascendente)", async () => {
        const owner = await createTestUser("Dueño Contactos");
        const userA = await createTestUser("Contacto A");
        const userB = await createTestUser("Contacto B");
        const userC = await createTestUser("Contacto C");

        const contactAId = await addContactFor(owner, userA);
        const contactBId = await addContactFor(owner, userB);
        const contactCId = await addContactFor(owner, userC);

        const res = await listContacts(owner);
        expect(res.status).toBe(200);
        const ids = res.body.contacts.map((c: { id: string }) => c.id);

        // Sin transferencias, ambos tienen lastTransferredAt null y se ordenan por _id ascendente
        expect(ids).toEqual([contactAId, contactBId, contactCId]);
    });

    it("una transferencia exitosa coloca su contacto primero", async () => {
        const ana = await createTestUser("Ana");
        const beto = await createTestUser("Beto");
        const carla = await createTestUser("Carla");
        await fund(ana, "EUR", 10_000);

        const contactBetoId = await addContactFor(ana, beto);
        const contactCarlaId = await addContactFor(ana, carla);

        // Enviar a Carla
        const sendRes = await send(ana, contactCarlaId, { currency: "EUR", amountCents: 1_000 });
        expect(sendRes.status).toBe(201);

        // Carla ahora debe aparecer en primera posición
        const listRes = await listContacts(ana);
        const ids = listRes.body.contacts.map((c: { id: string }) => c.id);
        expect(ids).toEqual([contactCarlaId, contactBetoId]);

        // Verificar que en base de datos Carla tiene lastTransferredAt
        const contactDoc = await Contact.findById(contactCarlaId);
        expect(contactDoc?.lastTransferredAt).toBeInstanceOf(Date);
    });

    it("dos envíos a contactos distintos producen el orden esperado (el último primero)", async () => {
        const ana = await createTestUser("Ana");
        const beto = await createTestUser("Beto");
        const carla = await createTestUser("Carla");
        const diego = await createTestUser("Diego");
        await fund(ana, "EUR", 20_000);

        const betoId = await addContactFor(ana, beto);
        const carlaId = await addContactFor(ana, carla);
        const diegoId = await addContactFor(ana, diego);

        // 1. Enviar primero a Beto
        await send(ana, betoId, { currency: "EUR", amountCents: 1_000 });
        // Pequeño retardo para asegurar timestamps estrictamente distintos
        await new Promise((r) => setTimeout(r, 20));

        // 2. Enviar después a Carla
        await send(ana, carlaId, { currency: "EUR", amountCents: 1_000 });

        // Orden esperado: Carla (más reciente), Beto (anterior), Diego (sin transferencias)
        const listRes = await listContacts(ana);
        const ids = listRes.body.contacts.map((c: { id: string }) => c.id);
        expect(ids).toEqual([carlaId, betoId, diegoId]);
    });

    it("enviar de nuevo a un contacto visible lo mueve al principio sin duplicarlo", async () => {
        const ana = await createTestUser("Ana");
        const beto = await createTestUser("Beto");
        const carla = await createTestUser("Carla");
        await fund(ana, "EUR", 20_000);

        const betoId = await addContactFor(ana, beto);
        const carlaId = await addContactFor(ana, carla);

        // Enviar a Beto, luego a Carla -> [Carla, Beto]
        await send(ana, betoId, { currency: "EUR", amountCents: 1_000 });
        await new Promise((r) => setTimeout(r, 20));
        await send(ana, carlaId, { currency: "EUR", amountCents: 1_000 });

        let list = await listContacts(ana);
        expect(list.body.contacts.map((c: { id: string }) => c.id)).toEqual([carlaId, betoId]);

        // Volver a enviar a Beto -> Beto pasa al principio: [Beto, Carla]
        await new Promise((r) => setTimeout(r, 20));
        await send(ana, betoId, { currency: "EUR", amountCents: 500 });

        list = await listContacts(ana);
        expect(list.body.contacts).toHaveLength(2);
        expect(list.body.contacts.map((c: { id: string }) => c.id)).toEqual([betoId, carlaId]);
    });

    it("saldo insuficiente no modifica lastTransferredAt ni el orden", async () => {
        const ana = await createTestUser("Ana");
        const beto = await createTestUser("Beto");
        const carla = await createTestUser("Carla");
        await fund(ana, "EUR", 5_000);

        const betoId = await addContactFor(ana, beto);
        const carlaId = await addContactFor(ana, carla);

        // Envío previo a Beto
        await send(ana, betoId, { currency: "EUR", amountCents: 1_000 });
        const listBefore = await listContacts(ana);
        expect(listBefore.body.contacts.map((c: { id: string }) => c.id)).toEqual([betoId, carlaId]);

        // Intento fallido a Carla (sin saldo suficiente: 10.000 > 4.000 restante)
        const failRes = await send(ana, carlaId, { currency: "EUR", amountCents: 10_000 });
        expect(failRes.status).toBe(422);

        // Carla sigue sin fecha y el orden permanece idéntico
        const carlaDoc = await Contact.findById(carlaId);
        expect(carlaDoc?.lastTransferredAt).toBeNull();

        const listAfter = await listContacts(ana);
        expect(listAfter.body.contacts.map((c: { id: string }) => c.id)).toEqual([betoId, carlaId]);
    });

    it("repetición idempotente no modifica la fecha original", async () => {
        const ana = await createTestUser("Ana");
        const beto = await createTestUser("Beto");
        await fund(ana, "EUR", 10_000);
        const betoId = await addContactFor(ana, beto);

        const idempKey = "key-idemp-date-check";
        const res1 = await send(ana, betoId, { currency: "EUR", amountCents: 1_000 }, idempKey);
        expect(res1.status).toBe(201);

        const betoDoc1 = await Contact.findById(betoId);
        const firstDate = betoDoc1?.lastTransferredAt?.getTime();
        expect(firstDate).toBeDefined();

        await new Promise((r) => setTimeout(r, 50));

        // Repetir misma petición con misma clave
        const res2 = await send(ana, betoId, { currency: "EUR", amountCents: 1_000 }, idempKey);
        expect(res2.status).toBe(200);
        expect(res2.headers["idempotent-replayed"]).toBe("true");

        const betoDoc2 = await Contact.findById(betoId);
        expect(betoDoc2?.lastTransferredAt?.getTime()).toBe(firstDate);
    });

    it("caso importante: enviar a A, luego a B y repetir la petición antigua de A conserva B antes que A", async () => {
        const ana = await createTestUser("Ana");
        const beto = await createTestUser("Beto A");
        const carla = await createTestUser("Carla B");
        await fund(ana, "EUR", 20_000);

        const betoId = await addContactFor(ana, beto);
        const carlaId = await addContactFor(ana, carla);

        const keyA = "idemp-key-user-a";
        const keyB = "idemp-key-user-b";

        // 1. Enviar a Beto (A)
        const sendA = await send(ana, betoId, { currency: "EUR", amountCents: 1_000 }, keyA);
        expect(sendA.status).toBe(201);

        await new Promise((r) => setTimeout(r, 30));

        // 2. Enviar a Carla (B)
        const sendB = await send(ana, carlaId, { currency: "EUR", amountCents: 1_000 }, keyB);
        expect(sendB.status).toBe(201);

        // En este momento Carla (B) está antes que Beto (A)
        let list = await listContacts(ana);
        expect(list.body.contacts.map((c: { id: string }) => c.id)).toEqual([carlaId, betoId]);

        await new Promise((r) => setTimeout(r, 30));

        // 3. Repetir la petición antigua a Beto con keyA
        const replayA = await send(ana, betoId, { currency: "EUR", amountCents: 1_000 }, keyA);
        expect(replayA.status).toBe(200);
        expect(replayA.headers["idempotent-replayed"]).toBe("true");

        // Carla (B) debe continuar antes que Beto (A)
        list = await listContacts(ana);
        expect(list.body.contacts.map((c: { id: string }) => c.id)).toEqual([carlaId, betoId]);
    });

    it("aislamiento: la actividad de un usuario no reordena los contactos de otro", async () => {
        const user1 = await createTestUser("Usuario 1");
        const user2 = await createTestUser("Usuario 2");
        const target = await createTestUser("Destinatario");

        await fund(user1, "EUR", 10_000);
        await fund(user2, "EUR", 10_000);

        const contactU1 = await addContactFor(user1, target);
        const contactU2 = await addContactFor(user2, target);

        // User 1 envía a target
        await send(user1, contactU1, { currency: "EUR", amountCents: 1_000 });

        // Contacto en user1 tiene fecha
        const doc1 = await Contact.findById(contactU1);
        expect(doc1?.lastTransferredAt).toBeInstanceOf(Date);

        // Contacto en user2 sigue sin fecha
        const doc2 = await Contact.findById(contactU2);
        expect(doc2?.lastTransferredAt).toBeNull();
    });

    it("fallo transaccional no deja la fecha actualizada", async () => {
        const ana = await createTestUser("Ana");
        const beto = await createTestUser("Beto");
        await fund(ana, "EUR", 10_000);
        const betoId = await addContactFor(ana, beto);

        // Simular un fallo dentro de la transacción forzando error en Movement.create
        const spy = vi.spyOn(Movement, "create").mockImplementationOnce(async () => {
            throw new Error("Simulated database failure during movement creation");
        });

        const res = await send(ana, betoId, { currency: "EUR", amountCents: 1_000 });
        expect(res.status).toBe(500);

        spy.mockRestore();

        // Al haberse ejecutado en la misma transacción, el contacto NO tiene fecha actualizada
        const betoDoc = await Contact.findById(betoId);
        expect(betoDoc?.lastTransferredAt).toBeNull();
    });
});
