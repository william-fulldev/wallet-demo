import { describe, expect, it } from "vitest";
import { Account } from "../../models/account.model.js";
import { Contact } from "../../models/contact.model.js";
import { Movement } from "../../models/movement.model.js";
import { RefreshToken } from "../../models/refresh-token.model.js";
import { Transfer } from "../../models/transfer.model.js";
import { User } from "../../models/user.model.js";
import { createTestUser } from "../../test/helpers.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { depositToAccount } from "../accounts/accounts.service.js";
import { startSession } from "../accounts/refresh-tokens.service.js";
import { registerUser } from "../auth/auth.service.js";
import {
    DEMO_USERS,
    LEGACY_DEMO_EMAILS,
    demoPassword,
} from "./demo-users.js";
import { seedDemoUsers } from "./demo.service.js";
import {
    applyMigrateDemoUsers,
    previewMigrateDemoUsers,
} from "./migrate-demo-users.service.js";

const OLD_PASSWORD = "OldPassword123!";

/**
 * Crea los 9 usuarios demo con sus correos antiguos y contraseña común
 */
async function seedLegacyDemoUsers(password: string = OLD_PASSWORD): Promise<Map<string, string>> {
    const idsByHandle = new Map<string, string>();

    for (const demo of DEMO_USERS) {
        const legacyEmail = LEGACY_DEMO_EMAILS[demo.handle];
        const user = await registerUser({
            name: demo.name,
            email: legacyEmail,
            password,
        });

        await User.updateOne({ _id: user.id }, { $set: { avatarId: demo.avatarId } });
        idsByHandle.set(demo.handle, user.id);
    }

    return idsByHandle;
}

describe("migración de usuarios demo (migrateDemoUsers)", () => {
    it("la simulación reporta los 10 usuarios listos pero no modifica ningún dato en la base", async () => {
        const ids = await seedLegacyDemoUsers();
        expect(ids.size).toBe(DEMO_USERS.length);

        // Guardar hashes y correos antes de la simulación
        const usersBefore = await User.find().select("+passwordHash");
        const hashesBefore = new Map(usersBefore.map((u) => [u.id, u.passwordHash]));

        const preview = await previewMigrateDemoUsers();

        expect(preview.totalUsers).toBe(DEMO_USERS.length);
        expect(preview.migrated).toBe(DEMO_USERS.length);
        expect(preview.alreadyMigrated).toBe(0);
        expect(preview.conflicts).toBe(0);
        expect(preview.notFound).toBe(0);

        for (const item of preview.items) {
            expect(item.passwordWillChange).toBe(true);
            expect(item.status).toBe("migrated");
            expect(item.newEmail).toContain("@gmail.com");
            expect(item.legacyEmail).toContain("@wallet.demo");
        }

        // Comprobación de que la base de datos sigue intacta
        const usersAfter = await User.find().select("+passwordHash");
        for (const user of usersAfter) {
            expect(user.email).toContain("@wallet.demo");
            expect(user.passwordHash).toBe(hashesBefore.get(user.id));
        }
    });

    it("aplica la migración conservando _id, saldos, movimientos y contactos, revoca refresh tokens e incluye a Laura B. y Griffin A.", async () => {
        const ids = await seedLegacyDemoUsers();
        const alanaId = ids.get("alana")!;
        const kerolId = ids.get("kerol")!;
        const lauraId = ids.get("laura")!;
        const griffinId = ids.get("griffin")!;

        expect(alanaId).toBeDefined();
        expect(kerolId).toBeDefined();
        expect(lauraId).toBeDefined();
        expect(griffinId).toBeDefined();

        // 1. Crear un usuario ajeno que no es de demostración
        const outsider = await createTestUser("Usuario Ajeno");
        const outsiderOriginalEmail = outsider.email;

        // 2. Crear contactos entre Alana, Kerol y el usuario ajeno
        const contactKerol = await Contact.create({ owner: alanaId, user: kerolId });
        const contactOutsider = await Contact.create({ owner: alanaId, user: outsider.id });

        // 3. Crear saldos y una transferencia entre Alana y Kerol
        await depositToAccount(alanaId, "EUR", 50_000);
        await depositToAccount(kerolId, "EUR", 50_000);

        const alanaEurAcc = await Account.findOne({ user: alanaId, currency: "EUR" });
        const kerolEurAcc = await Account.findOne({ user: kerolId, currency: "EUR" });

        const transfer = await Transfer.create({
            sender: alanaId,
            recipient: kerolId,
            currency: "EUR",
            amountCents: 1000,
            idempotencyKey: "test-migrate-trans-01",
        });

        await Movement.create({
            user: alanaId,
            account: alanaEurAcc!._id,
            currency: "EUR",
            type: "transfer_out",
            amountCents: 1000,
            balanceAfterCents: 49_000,
            transferId: transfer._id,
        });

        await Movement.create({
            user: kerolId,
            account: kerolEurAcc!._id,
            currency: "EUR",
            type: "transfer_in",
            amountCents: 1000,
            balanceAfterCents: 51_000,
            transferId: transfer._id,
        });

        // 4. Crear sesión activa (refresh token) para Alana
        const tokenAlana = await startSession(alanaId);
        expect(tokenAlana).toBeDefined();

        const activeTokensBefore = await RefreshToken.find({ user: alanaId, revokedAt: null });
        expect(activeTokensBefore).toHaveLength(1);

        // 5. Ejecutar applyMigrateDemoUsers()
        const result = await applyMigrateDemoUsers();

        expect(result.migrated).toBe(DEMO_USERS.length);
        expect(result.alreadyMigrated).toBe(0);
        expect(result.conflicts).toBe(0);
        expect(result.notFound).toBe(0);

        // 6. Verificaciones por cada usuario demo:
        for (const demo of DEMO_USERS) {
            const originalId = ids.get(demo.handle)!;
            const updatedUser = await User.findById(originalId).select("+passwordHash");

            expect(updatedUser).not.toBeNull();
            expect(updatedUser!.id).toBe(originalId); // Mismo _id
            expect(updatedUser!.name).toBe(demo.name); // Mismo nombre
            expect(updatedUser!.avatarId).toBe(demo.avatarId); // Mismo avatar
            expect(updatedUser!.email).toBe(demo.email); // Correo nuevo (@gmail.com)

            // Contraseña nueva coincide
            const newPasswordMatches = await verifyPassword(demoPassword(demo), updatedUser!.passwordHash);
            expect(newPasswordMatches).toBe(true);

            // Contraseña antigua ya no coincide
            const oldPasswordMatches = await verifyPassword(OLD_PASSWORD, updatedUser!.passwordHash);
            expect(oldPasswordMatches).toBe(false);
        }

        // Verificación específica de Laura B. (109)
        const lauraUser = await User.findById(lauraId).select("+passwordHash");
        expect(lauraUser?.name).toBe("Laura B.");
        expect(lauraUser?.email).toBe("laura.demo@gmail.com");
        expect(await verifyPassword("Password109!", lauraUser!.passwordHash)).toBe(true);

        // Verificación específica de Griffin A. (110)
        const griffinUser = await User.findById(griffinId).select("+passwordHash");
        expect(griffinUser?.name).toBe("Griffin A.");
        expect(griffinUser?.email).toBe("griffin.demo@gmail.com");
        expect(await verifyPassword("Password110!", griffinUser!.passwordHash)).toBe(true);

        // 7. Refresh token activo de Alana quedó revocado
        const activeTokensAfter = await RefreshToken.find({ user: alanaId, revokedAt: null });
        expect(activeTokensAfter).toHaveLength(0);
        const revokedToken = await RefreshToken.findOne({ user: alanaId });
        expect(revokedToken?.revokedAt).toBeInstanceOf(Date);

        // 8. Contactos intactos
        const alanaContacts = await Contact.find({ owner: alanaId }).sort({ _id: 1 });
        expect(alanaContacts).toHaveLength(2);
        expect(alanaContacts[0]._id.toString()).toBe(contactKerol._id.toString());
        expect(alanaContacts[1]._id.toString()).toBe(contactOutsider._id.toString());

        // 9. Saldos, transferencias y movimientos intactos
        const transfers = await Transfer.find();
        expect(transfers).toHaveLength(1);
        expect(transfers[0]._id.toString()).toBe(transfer._id.toString());

        const movements = await Movement.find({ transferId: transfer._id });
        expect(movements).toHaveLength(2);

        // 10. El usuario ajeno no fue modificado en absoluto
        const outsiderAfter = await User.findById(outsider.id);
        expect(outsiderAfter?.email).toBe(outsiderOriginalEmail);
        expect(outsiderAfter?.name).toBe("Usuario Ajeno");
    });

    it("es idempotente: una segunda ejecución no realiza cambios ni reescribe hashes, y seed:demo posterior no duplica usuarios", async () => {
        await seedLegacyDemoUsers();

        // Primera ejecución real
        const firstRun = await applyMigrateDemoUsers();
        expect(firstRun.migrated).toBe(DEMO_USERS.length);

        // Guardar hashes actuales
        const usersFirstRun = await User.find().select("+passwordHash");
        const hashesAfterFirst = new Map(usersFirstRun.map((u) => [u.id, u.passwordHash]));

        // Segunda ejecución real
        const secondRun = await applyMigrateDemoUsers();
        expect(secondRun.migrated).toBe(0);
        expect(secondRun.alreadyMigrated).toBe(DEMO_USERS.length);
        expect(secondRun.conflicts).toBe(0);

        // Los hashes no se reescribieron
        const usersSecondRun = await User.find().select("+passwordHash");
        for (const u of usersSecondRun) {
            expect(u.passwordHash).toBe(hashesAfterFirst.get(u.id));
        }

        // seed:demo posterior no crea ningún usuario nuevo
        const seedResult = await seedDemoUsers();
        expect(seedResult.usersCreated).toBe(0);
        expect(seedResult.usersExisting).toBe(DEMO_USERS.length);

        const totalUsers = await User.countDocuments();
        expect(totalUsers).toBe(DEMO_USERS.length);
    });

    it("detecta conflicto si un usuario ajeno ya tiene el correo nuevo, no sobreescribe y Alana conserva correo y contraseña antiguos", async () => {
        const ids = await seedLegacyDemoUsers();
        const alanaId = ids.get("alana")!;

        // Un usuario ajeno se registró previamente con "alana.demo@gmail.com"
        const stranger = await registerUser({
            name: "Usuario Invasor",
            email: "alana.demo@gmail.com",
            password: "StrangerPassword99!",
        });

        const result = await applyMigrateDemoUsers();

        // 1 conflicto (Alana), N-1 migrados
        expect(result.conflicts).toBe(1);
        expect(result.migrated).toBe(DEMO_USERS.length - 1);

        const alanaItem = result.items.find((i) => i.handle === "alana");
        expect(alanaItem?.status).toBe("conflict");
        expect(alanaItem?.details).toContain("Conflicto");

        // Alana conserva su correo y contraseña antiguos intactos
        const alanaUser = await User.findById(alanaId).select("+passwordHash");
        expect(alanaUser?.email).toBe("alana.demo@wallet.demo");
        expect(await verifyPassword(OLD_PASSWORD, alanaUser!.passwordHash)).toBe(true);

        // El usuario invasor no fue sobreescrito ni tocado
        const strangerAfter = await User.findById(stranger.id).select("+passwordHash");
        expect(strangerAfter?.email).toBe("alana.demo@gmail.com");
        expect(strangerAfter?.name).toBe("Usuario Invasor");
        expect(await verifyPassword("StrangerPassword99!", strangerAfter!.passwordHash)).toBe(true);

        // Los otros 8 usuarios migraron correctamente
        const kerolUser = await User.findById(ids.get("kerol")!).select("+passwordHash");
        expect(kerolUser?.email).toBe("kerol.demo@gmail.com");
        expect(await verifyPassword("Password102!", kerolUser!.passwordHash)).toBe(true);
    });
});
