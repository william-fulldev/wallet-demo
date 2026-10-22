import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../app.js";
import { authHeader, createTestUser, type TestUser } from "../../test/helpers.js";

function addContact(user: TestUser, email: string) {
    return request(app).post("/api/contacts").set(authHeader(user)).send({ email });
}

function listContacts(user: TestUser) {
    return request(app).get("/api/contacts").set(authHeader(user));
}

describe("contactos", () => {
    it("añade un contacto por correo y no expone su correo", async () => {
        const owner = await createTestUser();
        const other = await createTestUser();

        const response = await addContact(owner, other.email);

        expect(response.status).toBe(201);
        expect(response.body.contact).toMatchObject({ name: "Usuario Prueba", avatarId: null });
        expect(JSON.stringify(response.body)).not.toContain(other.email);
    });

    it("lista los contactos propios", async () => {
        const owner = await createTestUser();
        const other = await createTestUser();
        await addContact(owner, other.email);

        const response = await listContacts(owner);

        expect(response.status).toBe(200);
        expect(response.body.contacts).toHaveLength(1);
    });

    it("normaliza el correo: mayúsculas y espacios", async () => {
        const owner = await createTestUser();
        const other = await createTestUser();

        const response = await addContact(owner, `  ${other.email.toUpperCase()}  `);

        expect(response.status).toBe(201);
    });

    it("rechaza un correo que no pertenece a nadie", async () => {
        const owner = await createTestUser();

        const response = await addContact(owner, "nadie@example.com");

        expect(response.status).toBe(404);
    });

    it("no permite añadirse a uno mismo", async () => {
        const owner = await createTestUser();

        const response = await addContact(owner, owner.email);

        expect(response.status).toBe(422);
    });

    it("rechaza un contacto duplicado", async () => {
        const owner = await createTestUser();
        const other = await createTestUser();
        await addContact(owner, other.email);

        const response = await addContact(owner, other.email);

        expect(response.status).toBe(409);
    });

    it("aísla a los usuarios: no ven ni borran contactos ajenos", async () => {
        const owner = await createTestUser();
        const stranger = await createTestUser();
        const other = await createTestUser();
        const created = await addContact(owner, other.email);
        const contactId = created.body.contact.id as string;

        const strangerList = await listContacts(stranger);
        const strangerDelete = await request(app)
            .delete(`/api/contacts/${contactId}`)
            .set(authHeader(stranger));
        const ownerList = await listContacts(owner);

        expect(strangerList.body.contacts).toHaveLength(0);
        expect(strangerDelete.status).toBe(404);
        expect(ownerList.body.contacts).toHaveLength(1);
    });

    it("borra un contacto propio", async () => {
        const owner = await createTestUser();
        const other = await createTestUser();
        const created = await addContact(owner, other.email);

        const removed = await request(app)
            .delete(`/api/contacts/${created.body.contact.id}`)
            .set(authHeader(owner));
        const list = await listContacts(owner);

        expect(removed.status).toBe(204);
        expect(list.body.contacts).toHaveLength(0);
    });

    it("valida la entrada: campo extra e identificador inválido", async () => {
        const owner = await createTestUser();

        const extra = await request(app)
            .post("/api/contacts")
            .set(authHeader(owner))
            .send({ email: "a@example.com", role: "admin" });
        const badId = await request(app).delete("/api/contacts/123").set(authHeader(owner));

        expect(extra.status).toBe(400);
        expect(badId.status).toBe(400);
    });

    it("exige autenticación", async () => {
        const response = await request(app).get("/api/contacts");

        expect(response.status).toBe(401);
    });
});
