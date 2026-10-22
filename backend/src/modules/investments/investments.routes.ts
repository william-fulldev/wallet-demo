import { Router } from "express";
import { moneyLimiter } from "../../middleware/rate-limit.js";
import { requireAuth } from "../../middleware/require-auth.js";
import {
    buyInvestmentController,
    getInvestmentsController,
    sellInvestmentController,
} from "./investments.controller.js";

export const investmentsRouter = Router();

investmentsRouter.use(requireAuth);

investmentsRouter.get("/", getInvestmentsController);
investmentsRouter.post("/buy", moneyLimiter, buyInvestmentController);
investmentsRouter.post("/sell", moneyLimiter, sellInvestmentController);
