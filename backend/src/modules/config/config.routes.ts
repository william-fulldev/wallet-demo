import { Router } from "express";
import { env } from "../../config/env.js";

export const configRouter = Router();

// Endpoint público para consultar las características habilitadas en el frontend.
configRouter.get("/features", (_req, res) => {
    res.status(200).json({
        depositsEnabled: env.DEPOSITS_ENABLED,
    });
});
