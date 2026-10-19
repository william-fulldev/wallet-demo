import mongoose from "mongoose";
import { ensureAccounts } from "../accounts/accounts.service.js";
import { User } from "../../models/user.model.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import type { LoginInput, RegisterInput } from "./auth.schemas.js";



// Creo un error propio para el caso "ese correo ya existe".
// Así, quien me llame puede reconocerlo y responder con el código HTTP adecuado.
export class EmailAlreadyRegisteredError extends Error {
    constructor() {
        super("El correo ya está registrado.");
        this.name = "EmailAlreadyRegisteredError";
    }
}

// Defino los únicos datos del usuario que puedo devolver al exterior.
// No incluyo passwordHash: nunca debe salir de mi servidor.
export type PublicUser = {
    id: string;
    name: string;
    email: string;
    createdAt: Date;
};

// Preparo un hash falso al arrancar, para poder comparar aunque el usuario no exista.
// Así el login tarda casi lo mismo con un correo real que con uno inventado.
const dummyHashPromise = hashPassword("contraseña-falsa-para-igualar-tiempos");

// Creo un error propio para "correo o contraseña incorrectos".
// Uso un único mensaje para ambos casos, para no revelar si el correo existe.
export class InvalidCredentialsError extends Error {
    constructor() {
        super("Credenciales inválidas.");
        this.name = "InvalidCredentialsError";
    }
}

// Error propio para "el usuario del token ya no existe".
export class UserNotFoundError extends Error {
    constructor() {
        super("Usuario no encontrado.");
        this.name = "UserNotFoundError";
    }
}

// Detecto el error que lanza MongoDB cuando se rompe un índice único (código 11000).
function isDuplicateKeyError(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000
    );
}

// Registro a un usuario nuevo y le creo sus cuentas, todo o nada.
export async function registerUser(input: RegisterInput): Promise<PublicUser> {
    // Calculo el hash antes de abrir la transacción: bcrypt es lento y no debe mantenerla abierta.
    const passwordHash = await hashPassword(input.password);

    const session = await mongoose.startSession();
    let result = null as PublicUser | null;

    try {
        await session.withTransaction(async () => {
            const [user] = await User.create(
                [{ name: input.name, email: input.email, passwordHash }],
                { session },
            );

            // Las cuentas se crean en la misma transacción que el usuario.
            await ensureAccounts(user.id, session);

            result = {
                id: user.id,
                name: user.name,
                email: user.email,
                createdAt: user.createdAt,
            };
        });
    } catch (error) {
        // Si el correo ya existía, lo convierto en mi error propio.
        if (isDuplicateKeyError(error)) {
            throw new EmailAlreadyRegisteredError();
        }

        throw error;
    } finally {
        await session.endSession();
    }

    if (!result) {
        throw new Error("La transacción terminó sin resultado.");
    }

    return result;
}

// Compruebo las credenciales de un usuario que ya ha pasado la validación.
export async function loginUser(input: LoginInput): Promise<PublicUser> {
    // Pido el hash explícitamente, porque en el modelo lo excluí con select: false.
    const user = await User.findOne({ email: input.email }).select("+passwordHash");

    // Si no hay usuario, uso el hash falso para hacer igualmente la comparación.
    const hashToCompare = user?.passwordHash ?? (await dummyHashPromise);
    const passwordMatches = await verifyPassword(input.password, hashToCompare);

    // Doy la misma respuesta para "no existe" y "contraseña incorrecta".
    if (!user || !passwordMatches) {
        throw new InvalidCredentialsError();
    }

    // Devuelvo solo los campos públicos, igual que en el registro.
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
    };
}

// Busco al usuario que identifica un token ya verificado.
export async function getUserById(userId: string): Promise<PublicUser> {
    const user = await User.findById(userId);

    // El token puede ser válido aunque la cuenta se haya borrado después.
    if (!user) {
        throw new UserNotFoundError();
    }

    return {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
    };
}
