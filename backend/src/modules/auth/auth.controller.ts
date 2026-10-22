import type { Request, Response } from "express";
import * as z from "zod";
import { loginSchema, refreshBodySchema, registerSchema } from "./auth.schemas.js";
import { signAccessToken } from "../../utils/token.js";
import { EmailAlreadyRegisteredError, InvalidCredentialsError, UserNotFoundError, getUserById, loginUser, registerUser } from "./auth.service.js";
import { InvalidRefreshTokenError, revokeSession, rotateRefreshToken, startSession } from "../accounts/refresh-tokens.service.js";
import { getAuthenticatedUserId } from "../../utils/auth-context.js";

// Atiendo la petición de registro: valido, creo el usuario y respondo.
export async function register(req: Request, res: Response): Promise<void> {
    // Valido el cuerpo con mi esquema. "safeParse" no lanza error: me devuelve el resultado.
    const parsed = registerSchema.safeParse(req.body);

    // Si los datos no cumplen mis reglas, respondo 400 con los errores agrupados por campo.
    if (!parsed.success) {
        res.status(400).json({
            message: "Datos no válidos.",
            errors: z.flattenError(parsed.error).fieldErrors,
        });
        return;
    }

    try {
        // Uso parsed.data, que ya está limpio (sin espacios sobrantes y con el correo en minúsculas).
        const user = await registerUser(parsed.data);

        const accessToken = await signAccessToken(user.id);
        const refreshToken = await startSession(user.id);

        // 201 significa "creado".
        res.status(201).json({ user, accessToken, refreshToken });
    } catch (error) {
        // Si el correo ya existe, respondo 409 (conflicto) con mi mensaje.
        if (error instanceof EmailAlreadyRegisteredError) {
            res.status(409).json({ message: error.message });
            return;
        }

        // Cualquier otro error inesperado: lo dejo subir para que lo trate el manejador de errores.
        throw error;
    }
}

// Atiendo la petición de inicio de sesión: valido, compruebo credenciales y respondo.
export async function login(req: Request, res: Response): Promise<void> {
    // Valido el cuerpo con el esquema de login.
    const parsed = loginSchema.safeParse(req.body);

    // Si el formato no es válido, respondo 400 con los errores por campo.
    if (!parsed.success) {
        res.status(400).json({
            message: "Datos no válidos.",
            errors: z.flattenError(parsed.error).fieldErrors,
        });
        return;
    }

    try {
        const user = await loginUser(parsed.data);

        // Firmo un token que identifica al usuario que acaba de autenticarse.
        const accessToken = await signAccessToken(user.id);
        const refreshToken = await startSession(user.id);

        // Entrego el usuario público, el access token y el refresh token.
        res.status(200).json({ user, accessToken, refreshToken });
    } catch (error) {
        // Si las credenciales fallan, respondo 401 con el mensaje genérico.
        if (error instanceof InvalidCredentialsError) {
            res.status(401).json({ message: error.message });
            return;
        }

        // Cualquier otro error sube al manejador central.
        throw error;
    }
}

export async function me(_req: Request, res: Response): Promise<void> {
    const userId = getAuthenticatedUserId(res);

    if (!userId) {
        res.status(401).json({ message: "Autenticación requerida." });
        return;
    }

    try {
        const user = await getUserById(userId);
        res.status(200).json({ user });
    } catch (error) {
        // Si la cuenta ya no existe, el token deja de servir.
        if (error instanceof UserNotFoundError) {
            res.status(401).json({ message: "Autenticación requerida." });
            return;
        }

        throw error;
    }
}

export async function refresh(req: Request, res: Response): Promise<void> {
    const body = refreshBodySchema.safeParse(req.body);

    if (!body.success) {
        res.status(400).json({ message: "Datos no válidos." });
        return;
    }

    try {
        const { userId, refreshToken } = await rotateRefreshToken(body.data.refreshToken);
        const accessToken = await signAccessToken(userId);

        res.status(200).json({ accessToken, refreshToken });
    } catch (error) {
        if (error instanceof InvalidRefreshTokenError) {
            res.status(401).json({ message: error.message });
            return;
        }

        throw error;
    }
}

export async function logout(req: Request, res: Response): Promise<void> {
    const body = refreshBodySchema.safeParse(req.body);

    if (!body.success) {
        res.status(400).json({ message: "Datos no válidos." });
        return;
    }

    await revokeSession(body.data.refreshToken);
    res.status(204).send();
}
