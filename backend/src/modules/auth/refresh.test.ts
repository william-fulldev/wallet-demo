import mongoose from "mongoose";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../app.js";
import { createTestUser } from "../../test/helpers.js";

function refresh(refreshToken: string) {
    return request(app).post("/api/auth/refresh").send({ refreshToken });
}

// Ojo: el limitador de login cuenta los errores (4xx) y bloquea al sexto.
// Este archivo provoca cuatro, así que añadir más pruebas de error exige repensarlo.
describe("sesiones con refresh token", () => {
    it("rota el token: entrega uno nuevo y distinto", async () => {
        const user = await createTestUser();

        const response = await refresh(user.refreshToken);

        expect(response.status).toBe(200);
        expect(response.body.accessToken).toEqual(expect.any(String));
        expect(response.body.refreshToken).toEqual(expect.any(String));
        expect(response.body.refreshToken).not.toBe(user.refreshToken);
    });

    it("detecta la reutilización y revoca la familia entera", async () => {
        const user = await createTestUser();
        const rotated = await refresh(user.refreshToken);

        const reuse = await refresh(user.refreshToken);
        const newest = await refresh(rotated.body.refreshToken);

        expect(reuse.status).toBe(401);
        expect(newest.status).toBe(401);
    });

    it("el logout revoca la sesión", async () => {
        const user = await createTestUser();

        const logout = await request(app)
            .post("/api/auth/logout")
            .send({ refreshToken: user.refreshToken });
        const afterLogout = await refresh(user.refreshToken);

        expect(logout.status).toBe(204);
        expect(afterLogout.status).toBe(401);
    });

    it("guarda solo el hash del token, nunca el token", async () => {
        const user = await createTestUser();

        const stored = await mongoose.connection.db?.collection("refreshtokens").findOne({});

        expect(stored?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
        expect(JSON.stringify(stored)).not.toContain(user.refreshToken);
    });

    it("rechaza un token inventado", async () => {
        const response = await refresh("token-que-nunca-existio");

        expect(response.status).toBe(401);
    });
});