import request from "supertest";
import { app } from "../app.js";
import { registerUser } from "../modules/auth/auth.service.js";

export type TestUser = {
    id: string;
    email: string;
    accessToken: string;
    refreshToken: string;
};

let counter = 0;

// Creo el usuario con el servicio y no por HTTP: el registro tiene límite de 10 por hora.
export async function createTestUser(name = "Usuario Prueba"): Promise<TestUser> {
    counter += 1;
    const email = `usuario${counter}@example.com`;
    const password = "Clave-De-Prueba-2026-Segura!";

    const user = await registerUser({ name, email, password });
    const response = await request(app).post("/api/auth/login").send({ email, password });

    if (response.status !== 200) {
        throw new Error(`El login de prueba falló con el código ${response.status}.`);
    }

    return {
        id: user.id,
        email,
        accessToken: response.body.accessToken,
        refreshToken: response.body.refreshToken,
    };
}

export function authHeader(user: TestUser): { Authorization: string } {
    return { Authorization: `Bearer ${user.accessToken}` };
}

// Dejo saldo en una cuenta usando la propia API, igual que haría un usuario.
export async function fund(user: TestUser, currency: string, amountCents: number): Promise<void> {
    const response = await request(app)
        .post(`/api/accounts/${currency}/deposit`)
        .set(authHeader(user))
        .send({ amountCents });

    if (response.status !== 201) {
        throw new Error(`El ingreso de prueba falló con el código ${response.status}.`);
    }
}

export async function addContactFor(owner: TestUser, other: TestUser): Promise<string> {
    const response = await request(app).post("/api/contacts").set(authHeader(owner)).send({ email: other.email });

    if (response.status !== 201) {
        throw new Error(`El contacto de prueba falló con el código ${response.status}.`);
    }

    return response.body.contact.id as string;
}

export async function getBalances(user: TestUser): Promise<Record<string, number>> {
    const response = await request(app).get("/api/accounts").set(authHeader(user));
    const accounts = response.body.accounts as { currency: string; balanceCents: number }[];

    return Object.fromEntries(accounts.map((account) => [account.currency, account.balanceCents]));
}

export async function getMovements(user: TestUser): Promise<Record<string, unknown>[]> {
    const response = await request(app).get("/api/accounts/movements").set(authHeader(user));
    return response.body.movements as Record<string, unknown>[];
}