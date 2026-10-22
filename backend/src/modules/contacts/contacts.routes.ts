import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { addContactLimiter } from "../../middleware/rate-limit.js";
import { createContact, deleteContact, getContacts } from "./contacts.controller.js";

export const contactsRouter = Router();

contactsRouter.use(requireAuth);

contactsRouter.get("/", getContacts);
contactsRouter.post("/", addContactLimiter, createContact);
contactsRouter.delete("/:id", deleteContact);
