import { Router } from "express";
import { moneyLimiter } from "../../middleware/rate-limit.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { createTransfer } from "./transfers.controller.js";

export const transfersRouter = Router();

transfersRouter.use(requireAuth);
transfersRouter.post("/", moneyLimiter, createTransfer);
