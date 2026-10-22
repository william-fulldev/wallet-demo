import { apiRequest } from "./client";
import type { Contact } from "./types";

export async function fetchContacts(): Promise<Contact[]> {
    const data = await apiRequest<{ contacts: Contact[] }>("/api/contacts");
    return data.contacts;
}

export async function addContact(email: string): Promise<Contact> {
    const data = await apiRequest<{ contact: Contact }>("/api/contacts", {
        method: "POST",
        body: { email },
    });
    return data.contact;
}

export function removeContact(id: string): Promise<void> {
    return apiRequest<void>(`/api/contacts/${id}`, { method: "DELETE" });
}
