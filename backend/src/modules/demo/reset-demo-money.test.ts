import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../../app.js";
import { env } from "../../config/env.js";
import { Account } from "../../models/account.model.js";
import { Contact } from "../../models/contact.model.js";
import { Holding } from "../../models/holding.model.js";
import { Movement } from "../../models/movement.model.js";
import { Trade } from "../../models/trade.model.js";
import { Transfer } from "../../models/transfer.model.js";
import { User } from "../../models/user.model.js";
import { addContactFor, authHeader, createTestUser, fund, getBalances } from "../../test/helpers.js";
import { registerUser } from "../auth/auth.service.js";
import {
    applyDemoMoneyReset,
    previewDemoMoneyReset,
} from "./reset-demo-money.service.js";

describe("reinicio total del dinero de la demo (reset-demo-money)", () => {
    const originalDemoMode = env.DEMO_MODE;

    afterEach(() => {
        env.DEMO_MODE = originalDemoMode;
        env.DEPOSITS_ENABLED = true;
    });

    it("simulación no modifica nada y applyDemoMoneyReset deja a todos los usuarios con 500 EUR, USD y BRL, borrando movimientos, transferencias e inversiones", async () => {
        // 1. Preparar escenario con 2 usuarios
        const userA = await createTestUser("Usuario A");
        const userB = await createTestUser("Usuario B");

        // Añadir contacto recíproco
        const contactBId = await addContactFor(userA, userB);

        // Ingresos, cambio de moneda, transferencia y compra
        await fund(userA, "EUR", 100_000);
        await fund(userA, "USD", 60_000);

        // Cambio EUR -> USD
        await request(app)
            .post("/api/accounts/exchange")
            .set(authHeader(userA))
            .send({ from: "EUR", to: "USD", amountCents: 10_000 });

        // Transferencia A -> B
        await request(app)
            .post("/api/transfers")
            .set(authHeader(userA))
            .set("Idempotency-Key", "reset-test-trans-01")
            .send({ contactId: contactBId, currency: "USD", amountCents: 15_000 });

        // Compra de inversión
        await request(app)
            .post("/api/investments/buy")
            .set(authHeader(userA))
            .set("Idempotency-Key", "reset-test-buy-01")
            .send({ symbol: "AAPL", amountCents: 10_000 });

        // Verificamos que existen documentos en las colecciones
        expect(await Transfer.countDocuments()).toBeGreaterThan(0);
        expect(await Holding.countDocuments()).toBeGreaterThan(0);
        expect(await Trade.countDocuments()).toBeGreaterThan(0);
        expect(await Movement.countDocuments()).toBeGreaterThan(0);
        expect(await Contact.countDocuments({ lastTransferredAt: { $ne: null } })).toBeGreaterThan(0);

        // 2. Ejecución de la SIMULACIÓN (preview)
        const preview = await previewDemoMoneyReset();
        expect(preview.totalUsers).toBeGreaterThanOrEqual(2);
        expect(preview.totalTransfers).toBeGreaterThan(0);
        expect(preview.totalHoldings).toBeGreaterThan(0);
        expect(preview.totalTrades).toBeGreaterThan(0);
        expect(preview.totalMovements).toBeGreaterThan(0);
        expect(preview.totalContactsWithLastTransferredAt).toBeGreaterThan(0);

        // La simulación no debe haber modificado ningún dato
        expect(await Transfer.countDocuments()).toBeGreaterThan(0);
        expect(await Holding.countDocuments()).toBeGreaterThan(0);
        expect(await Trade.countDocuments()).toBeGreaterThan(0);

        // 3. Ejecución del REINICIO REAL (apply)
        const result = await applyDemoMoneyReset();
        expect(result.usersReset).toBeGreaterThanOrEqual(2);
        expect(result.transfersDeleted).toBeGreaterThan(0);
        expect(result.holdingsDeleted).toBeGreaterThan(0);
        expect(result.tradesDeleted).toBeGreaterThan(0);

        // Verificaciones post-reinicio:
        // Cero transferencias, posiciones ni operaciones de inversión
        expect(await Transfer.countDocuments()).toBe(0);
        expect(await Holding.countDocuments()).toBe(0);
        expect(await Trade.countDocuments()).toBe(0);

        // Ningún contacto conserva lastTransferredAt
        expect(await Contact.countDocuments({ lastTransferredAt: { $ne: null } })).toBe(0);

        // Los usuarios y contactos se conservan
        expect(await User.findById(userA.id)).not.toBeNull();
        expect(await User.findById(userB.id)).not.toBeNull();
        expect(await Contact.countDocuments({ owner: userA.id })).toBe(1);

        // TODOS los usuarios quedan con exactamente 500,00 EUR, 500,00 USD y 500,00 BRL
        const balancesA = await getBalances(userA);
        expect(balancesA.EUR).toBe(50_000);
        expect(balancesA.USD).toBe(50_000);
        expect(balancesA.BRL).toBe(50_000);

        const balancesB = await getBalances(userB);
        expect(balancesB.EUR).toBe(50_000);
        expect(balancesB.USD).toBe(50_000);
        expect(balancesB.BRL).toBe(50_000);

        // Coherencia de balanceAfterCents en los movimientos creados
        const movementsA = await Movement.find({ user: userA.id }).sort({ createdAt: 1 });
        expect(movementsA).toHaveLength(11); // 3 depósitos (EUR, USD, BRL) + 8 gastos demo
        for (const m of movementsA) {
            expect(m.balanceAfterCents).toBeGreaterThanOrEqual(0);
        }

        // 4. Idempotencia: una segunda ejecución deja el mismo estado
        const secondResult = await applyDemoMoneyReset();
        expect(secondResult.usersReset).toBeGreaterThanOrEqual(2);
        expect(await Transfer.countDocuments()).toBe(0);
        expect(await Holding.countDocuments()).toBe(0);
        expect(await Trade.countDocuments()).toBe(0);

        const balancesA2 = await getBalances(userA);
        expect(balancesA2.EUR).toBe(50_000);
        expect(balancesA2.USD).toBe(50_000);
        expect(balancesA2.BRL).toBe(50_000);
    });

    it("un usuario registrado con DEMO_MODE activo parte con exactamente 500 EUR, 500 USD y 500 BRL", async () => {
        env.DEMO_MODE = true;

        const demoUser = await registerUser({
            name: "Nuevo Demo User",
            email: "nuevo.demo@example.com",
            password: "Password123!",
        });

        const accounts = await Account.find({ user: demoUser.id });
        expect(accounts).toHaveLength(3);

        const eur = accounts.find((a) => a.currency === "EUR");
        const usd = accounts.find((a) => a.currency === "USD");
        const brl = accounts.find((a) => a.currency === "BRL");

        expect(eur?.balanceCents).toBe(50_000); // 500,00 EUR
        expect(usd?.balanceCents).toBe(50_000); // 500,00 USD
        expect(brl?.balanceCents).toBe(50_000); // 500,00 BRL

        const payments = await Movement.find({ user: demoUser.id, type: "payment_out" });
        expect(payments).toHaveLength(8);

        const deposits = await Movement.find({ user: demoUser.id, type: "deposit" });
        expect(deposits).toHaveLength(3);
    });
});
