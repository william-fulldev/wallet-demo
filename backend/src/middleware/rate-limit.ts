import { rateLimit } from "express-rate-limit";

// Mensaje común para cuando alguien supera el límite.
const tooManyRequests = {
    message: "Demasiados intentos. Inténtalo de nuevo más tarde.",
};

// Limito el login: 5 intentos fallidos cada 15 minutos por dirección IP.
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    // Los logins correctos no cuentan: solo castigo los intentos fallidos.
    skipSuccessfulRequests: true,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: tooManyRequests,
});

// Limito el registro: 5 cuentas por hora y por dirección IP.
export const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: tooManyRequests,
});
