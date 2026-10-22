import type { Request, Response } from "express";
import { getAuthenticatedUserId } from "../../utils/auth-context.js";
import { listMarketAssets } from "./market.service.js";

export async function getMarketAssets(_req: Request, res: Response): Promise<void> {
    const userId = getAuthenticatedUserId(res);

    if (!userId) {
        res.status(401).json({ message: "Autenticación requerida." });
        return;
    }

    const assets = await listMarketAssets();
    res.status(200).json(assets);
}
