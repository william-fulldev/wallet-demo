import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../app.js";
import { authHeader, createTestUser, type TestUser } from "../../test/helpers.js";

function deposit(user: TestUser) {
    return request(app).post("/api/accounts/EUR/deposit").set(authHeader(user)).send({ amountCents: 100 });
}

describe("limitador de operaciones con dinero", () => {
    it("bloquea al usuario que excede el límite sin afectar a otro", { timeout: 60_000 }, async () => {
        const heavy = await createTestUser();
        const other = await createTestUser();

        for (let i = 0; i < 20; i += 1) {
            expect((await deposit(heavy)).status).toBe(201);
        }

        expect((await deposit(heavy)).status).toBe(429);
        expect((await deposit(other)).status).toBe(201);
    });
});
