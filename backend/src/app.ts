import express from "express";
import { errorHandler } from "./middleware/error-handler.js";
import cors from "cors";

// Importo el enrutador que agrupa las rutas de autenticación.
import { authRouter } from "./modules/auth/auth.routes.js";
import { accountsRouter } from "./modules/accounts/accounts.routes.js";
import { env } from "process";

// Creo mi aplicación de Express.
// Aquí defino cómo responde mi API, pero todavía no la pongo a escuchar peticiones.
export const app = express();

// Enseño a mi API a aceptar peticiones desde el frontend.
app.use(
    cors({
        origin: env.CORS_ORIGINS,
        methods: ["GET", "POST", "PATCH", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"],
        maxAge: 600,
    }),
);

// Enseño a mi API a leer los datos JSON que me envíe el cliente.
// Lo registro antes de mis rutas para que ya estén leídos cuando lleguen a ellas.
app.use(express.json());

// Creo una ruta de comprobación para saber si mi API está viva.
// Uso _req porque no necesito leer la petición, solo responder.
app.get("/health", (_req, res) => {
    // Respondo con el código 200 (todo correcto) y un JSON sencillo.
    res.status(200).json({ status: "ok" });
});

// Monto las ruta de autenticación bajo el prefijo "/api/auth".
// Las coloco antes del 404 para que Express las encuentre primero.
app.use("/api/auth", authRouter);

// Monto las rutas de cuentas bajo el prefijo "/api/accounts".
app.use("/api/accounts", accountsRouter);

// Si ninguna ruta anterior coincide con la petición, respondo con un 404 en JSON.
// Lo coloco al final porque Express revisa mis rutas en el orden en que las escribo.
app.use((_req, res) => {
    res.status(404).json({ message: "Ruta no encontrada" });
});

// Registro el manejador de errores el último, para que recoja lo que fallen las rutas anteriores.
app.use(errorHandler);
