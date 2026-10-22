import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { app } from "../../app.js";
import { authHeader, createTestUser, fund, type TestUser } from "../../test/helpers.js";

// vi.mock se eleva sobre las importaciones: la fábrica solo puede usar literales.
vi.mock("./rates.service.js", () => ({
    getRates: async () => ({
        unitsPerEur: { EUR: 1_000_000n, USD: 1_100_000n, BRL: 5_000_000n },
        source: "api" as const,
        asOf: new Date("2026-10-20T12:00:00.000Z"),
    }),
}));

function exchange(user: TestUser, body: object) {
    return request(app).post("/api/accounts/exchange").set(authHeader(user)).send(body);
}

async function balances(user: TestUser): Promise<Record<string, number>> {
    const response = await request(app).get("/api/accounts").set(authHeader(user));
    const accounts = response.body.accounts as { currency: string; balanceCents: number }[];

    return Object.fromEntries(accounts.map((account) => [account.currency, account.balanceCents]));
}

async function movementCount(user: TestUser): Promise<number> {
    const response = await request(app).get("/api/accounts/movements").set(authHeader(user));
    return response.body.movements.length;
}

describe("POST /api/accounts/exchange", () => {
    it("cambia EUR a USD y anota dos apuntes enlazados", async () => {
        const user = await createTestUser();
        await fund(user, "EUR", 10_000);

        const response = await exchange(user, { from: "EUR", to: "USD", amountCents: 10_000 });

        expect(response.status).toBe(201);
        expect(response.body.sold.movement.type).toBe("exchange_out");
        expect(response.body.bought.movement.type).toBe("exchange_in");
        expect(response.body.sold.movement.exchangeId).toBe(response.body.exchangeId);
        expect(response.body.bought.movement.exchangeId).toBe(response.body.exchangeId);
        expect(response.body.rate.source).toBe("api");
        expect(await balances(user)).toMatchObject({ EUR: 0, USD: 11_000, BRL: 0 });
    });

    it("rechaza el cambio sin saldo suficiente y no cambia nada", async () => {
        const user = await createTestUser();
        await fund(user, "EUR", 5_000);

        const response = await exchange(user, { from: "EUR", to: "USD", amountCents: 6_000 });

        expect(response.status).toBe(422);
        expect(await balances(user)).toMatchObject({ EUR: 5_000, USD: 0 });
        // Solo queda el apunte del ingreso.
        expect(await movementCount(user)).toBe(1);
    });

    it("rechaza un importe que al convertirlo daría cero", async () => {
        const user = await createTestUser();
        await fund(user, "USD", 100);

        const response = await exchange(user, { from: "USD", to: "EUR", amountCents: 1 });

        expect(response.status).toBe(422);
        expect(await balances(user)).toMatchObject({ USD: 100, EUR: 0 });
    });

    it("rechaza monedas iguales con un error en el campo to", async () => {
        const user = await createTestUser();

        const response = await exchange(user, { from: "EUR", to: "EUR", amountCents: 100 });

        expect(response.status).toBe(400);
        expect(response.body.errors.to).toBeDefined();
    });

    it("con dos cambios simultáneos solo uno puede gastar el mismo saldo", async () => {
        const user = await createTestUser();
        await fund(user, "EUR", 10_000);

        const results = await Promise.all([
            exchange(user, { from: "EUR", to: "USD", amountCents: 6_000 }),
            exchange(user, { from: "EUR", to: "USD", amountCents: 6_000 }),
        ]);

        const statuses = results.map((result) => result.status).sort((a, b) => a - b);

        expect(statuses).toEqual([201, 422]);
        expect(await balances(user)).toMatchObject({ EUR: 4_000, USD: 6_600 });
    });

    it("exige autenticación", async () => {
        const response = await request(app)
            .post("/api/accounts/exchange")
            .send({ from: "EUR", to: "USD", amountCents: 100 });

        expect(response.status).toBe(401);
    });

    it("no deja ver los movimientos de otro usuario", async () => {
        const owner = await createTestUser();
        const stranger = await createTestUser();
        await fund(owner, "EUR", 1_000);

        expect(await movementCount(owner)).toBe(1);
        expect(await movementCount(stranger)).toBe(0);
    });
});