import { User } from "../../models/user.model.js";
import { isDuplicateKeyError } from "../../utils/mongo-errors.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { revokeAllUserSessions } from "../accounts/refresh-tokens.service.js";
import {
    DEMO_USERS,
    LEGACY_DEMO_EMAILS,
    demoPassword,
} from "./demo-users.js";

export type MigrateUserItem = {
    handle: string;
    name: string;
    legacyEmail: string;
    newEmail: string;
    passwordWillChange: boolean;
    status: "migrated" | "already_migrated" | "conflict" | "not_found";
    details?: string;
};

export type MigrateDemoUsersResult = {
    totalUsers: number;
    migrated: number;
    alreadyMigrated: number;
    conflicts: number;
    notFound: number;
    items: MigrateUserItem[];
};

/**
 * Migra los usuarios de demostración a sus nuevos correos (@gmail.com)
 * y contraseñas individuales (Password101! ... Password110!).
 *
 * REGLAS DE SEGURIDAD E INTEGRIDAD:
 * - Por defecto simula (!apply) y no modifica ningún dato en la base.
 * - Con apply: true:
 *   - Si un usuario ya fue migrado y su contraseña coincide, no lo toca.
 *   - Si existe conflicto (otro usuario ya tiene el correo nuevo), aborta ese
 *     usuario con aviso claro y no sobreescribe ni fusiona.
 *   - Si la contraseña cambia, revoca todas las sesiones activas (refresh tokens).
 *   - No toca _id, avatarId, cuentas, movimientos ni contactos.
 * - Idempotente: ejecutarla varias veces produce 0 modificaciones adicionales.
 * - Nunca expone contraseñas ni hashes en el resultado ni en logs.
 */
export async function migrateDemoUsers(options: { apply?: boolean } = {}): Promise<MigrateDemoUsersResult> {
    const apply = Boolean(options.apply);

    const items: MigrateUserItem[] = [];
    let migrated = 0;
    let alreadyMigrated = 0;
    let conflicts = 0;
    let notFound = 0;

    for (const demo of DEMO_USERS) {
        const legacyEmail = (LEGACY_DEMO_EMAILS[demo.handle] ?? `${demo.handle}.demo@wallet.demo`).trim().toLowerCase();
        const newEmail = demo.email;
        const expectedPassword = demoPassword(demo);

        // 1. Buscar al usuario: primero por el correo antiguo, o por el nuevo si ya fue migrado
        let user = await User.findOne({ email: legacyEmail }).select("+passwordHash");
        let foundByLegacy = true;

        if (!user) {
            user = await User.findOne({ email: newEmail }).select("+passwordHash");
            foundByLegacy = false;
        }

        if (!user) {
            items.push({
                handle: demo.handle,
                name: demo.name,
                legacyEmail,
                newEmail,
                passwordWillChange: false,
                status: "not_found",
                details: "Usuario no encontrado en la base de datos",
            });
            notFound++;
            continue;
        }

        // 2. Si se encontró por correo antiguo, comprobar si otro usuario ya tiene el correo nuevo
        if (foundByLegacy) {
            const existingWithNew = await User.findOne({ email: newEmail });
            if (existingWithNew && existingWithNew._id.toString() !== user._id.toString()) {
                items.push({
                    handle: demo.handle,
                    name: demo.name,
                    legacyEmail,
                    newEmail,
                    passwordWillChange: false,
                    status: "conflict",
                    details: `Conflicto: otro usuario ya tiene el correo ${newEmail}`,
                });
                conflicts++;
                continue;
            }
        }

        // 3. Comprobar si la contraseña actual coincide con la esperada
        const passwordMatches = user.passwordHash
            ? await verifyPassword(expectedPassword, user.passwordHash)
            : false;
        const passwordWillChange = !passwordMatches;

        // 4. Si ya tiene el correo nuevo y la contraseña ya coincide, ya está migrado
        if (!foundByLegacy && !passwordWillChange) {
            items.push({
                handle: demo.handle,
                name: demo.name,
                legacyEmail,
                newEmail,
                passwordWillChange: false,
                status: "already_migrated",
                details: "Ya migrado previamente (correo y contraseña actualizados)",
            });
            alreadyMigrated++;
            continue;
        }

        // 5. Modo simulación (apply === false): reportar sin escribir
        if (!apply) {
            items.push({
                handle: demo.handle,
                name: demo.name,
                legacyEmail,
                newEmail,
                passwordWillChange,
                status: "migrated",
                details: foundByLegacy ? "Listo para migrar correo y contraseña" : "Listo para migrar contraseña",
            });
            migrated++;
            continue;
        }

        // 6. Modo aplicación real (apply === true)
        try {
            const updateFields: { email?: string; passwordHash?: string } = {};

            if (foundByLegacy) {
                updateFields.email = newEmail;
            }

            if (passwordWillChange) {
                updateFields.passwordHash = await hashPassword(expectedPassword);
            }

            if (Object.keys(updateFields).length > 0) {
                await User.updateOne({ _id: user._id }, { $set: updateFields });
            }

            if (passwordWillChange) {
                await revokeAllUserSessions(user._id);
            }

            items.push({
                handle: demo.handle,
                name: demo.name,
                legacyEmail,
                newEmail,
                passwordWillChange,
                status: "migrated",
                details: "Migrado con éxito",
            });
            migrated++;
        } catch (error) {
            if (isDuplicateKeyError(error)) {
                items.push({
                    handle: demo.handle,
                    name: demo.name,
                    legacyEmail,
                    newEmail,
                    passwordWillChange: false,
                    status: "conflict",
                    details: `Conflicto de clave única: otro usuario registró ${newEmail}`,
                });
                conflicts++;
            } else {
                throw error;
            }
        }
    }

    return {
        totalUsers: DEMO_USERS.length,
        migrated,
        alreadyMigrated,
        conflicts,
        notFound,
        items,
    };
}

export async function previewMigrateDemoUsers(): Promise<MigrateDemoUsersResult> {
    return migrateDemoUsers({ apply: false });
}

export async function applyMigrateDemoUsers(): Promise<MigrateDemoUsersResult> {
    return migrateDemoUsers({ apply: true });
}
