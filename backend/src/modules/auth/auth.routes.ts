import { Router } from "express";
import { loginLimiter, registerLimiter } from "../../middleware/rate-limit.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { login, logout, me, refresh, register } from "./auth.controller.js";

// Creo un enrutador propio para agrupar todas las rutas de autenticación.
export const authRouter = Router();

// Rutas públicas: cada una pasa primero por su limitador correspondiente.
authRouter.post("/register", registerLimiter, register);
authRouter.post("/login", loginLimiter, login);
authRouter.post("/refresh", refresh);
authRouter.post("/logout", logout);

// Ruta protegida: requireAuth se ejecuta primero y solo deja pasar con un token válido.
authRouter.get("/me", requireAuth, me);
