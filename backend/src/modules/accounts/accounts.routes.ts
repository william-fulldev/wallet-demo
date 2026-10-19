import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { deposit, getAccounts, getMovements, exchange } from "./accounts.controller.js";

// Creo un enrutador propio para agrupar las rutas de cuentas.
export const accountsRouter = Router();

// Todas las rutas de cuentas exigen un usuario autenticado.
// Lo declaro una sola vez aquí, para que ninguna ruta futura se quede sin protección.
accountsRouter.use(requireAuth);

accountsRouter.get("/", getAccounts);

// GET, porque solo consulto. Los filtros viajan en la URL.
accountsRouter.get("/movements", getMovements);

// POST, porque el ingreso cambia el estado. La moneda va en la dirección y el importe en el cuerpo.
accountsRouter.post("/:currency/deposit", deposit);

// POST, porque un cambio crea un movimiento y actualiza dos cuentas.
accountsRouter.post("/exchange", exchange);
