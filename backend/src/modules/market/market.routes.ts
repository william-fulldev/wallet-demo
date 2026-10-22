import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { getMarketAssets } from "./market.controller.js";

export const marketRouter = Router();

marketRouter.use(requireAuth);
marketRouter.get("/assets", getMarketAssets);
