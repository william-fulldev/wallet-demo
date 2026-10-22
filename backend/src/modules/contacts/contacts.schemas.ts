import * as z from "zod";
import { emailSchema } from "../auth/auth.schemas.js";

export const addContactBodySchema = z.strictObject({
    email: emailSchema,
});

export const contactParamsSchema = z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, "El identificador no es válido."),
});
