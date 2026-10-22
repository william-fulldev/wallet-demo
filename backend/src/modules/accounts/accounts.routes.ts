import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { moneyLimiter } from "../../middleware/rate-limit.js";
import { env } from "../../config/env.js";
import { deposit, getAccounts, getMovements, exchange } from "./accounts.controller.js";

// Creo un enrutador propio para agrupar las rutas de cuentas.
export const accountsRouter = Router();

// Todas las rutas de cuentas exigen un usuario autenticado.
// Lo declaro una sola vez aquí, para que ninguna ruta futura se quede sin protección.
accountsRouter.use(requireAuth);

accountsRouter.get("/", getAccounts);

// GET, porque solo consulto. Los filtros viajan en la URL.
accountsRouter.get("/movements", getMovements);

function checkDepositsEnabled(_req: Request, res: Response, next: NextFunction): void {
    if (!env.DEPOSITS_ENABLED) {
        res.status(403).json({
            code: "DEPOSITS_DISABLED",
            message: "Los ingresos están desactivados en esta demo. Cada cuenta parte con 500 EUR, 500 USD y 500 BRL.",
        });
        return;
    }
    next();
}

// POST, porque el ingreso cambia el estado. La moneda va en la dirección y el importe en el cuerpo.
accountsRouter.post("/:currency/deposit", checkDepositsEnabled, moneyLimiter, deposit);

// POST, porque un cambio crea un movimiento y actualiza dos cuentas.
accountsRouter.post("/exchange", moneyLimiter, exchange);
