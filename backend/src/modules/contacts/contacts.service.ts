import { Contact } from "../../models/contact.model.js";
import { User } from "../../models/user.model.js";
import { isDuplicateKeyError } from "../../utils/mongo-errors.js";

// Lo único que un usuario puede saber de otro: su nombre y su retrato. Nunca el correo.
export type PublicContact = {
    id: string;
    name: string;
    avatarId: string | null;
};

export class ContactTargetNotFoundError extends Error {
    constructor() {
        super("No encontramos a ningún usuario con ese correo.");
        this.name = "ContactTargetNotFoundError";
    }
}

export class CannotAddSelfError extends Error {
    constructor() {
        super("No puedes añadirte a ti mismo como contacto.");
        this.name = "CannotAddSelfError";
    }
}

export class ContactAlreadyExistsError extends Error {
    constructor() {
        super("Ese usuario ya está en tus contactos.");
        this.name = "ContactAlreadyExistsError";
    }
}

export class ContactNotFoundError extends Error {
    constructor() {
        super("Contacto no encontrado.");
        this.name = "ContactNotFoundError";
    }
}

export async function listContacts(ownerId: string): Promise<PublicContact[]> {
    // Filtro siempre por dueño: nadie ve los contactos de otro.
    // Orden: 1. lastTransferredAt descendente (los más recientes primero).
    //        2. _id ascendente como desempate determinista.
    const contacts = await Contact.find({ owner: ownerId }).sort({ lastTransferredAt: -1, _id: 1 });

    const users = await User.find({ _id: { $in: contacts.map((contact) => contact.user) } }).select(
        "name avatarId",
    );
    const byId = new Map(users.map((user) => [user.id, user]));

    return contacts.flatMap((contact) => {
        const user = byId.get(contact.user.toString());

        // Si la cuenta del contacto ya no existe, lo omito en lugar de fallar.
        return user ? [{ id: contact.id, name: user.name, avatarId: user.avatarId ?? null }] : [];
    });
}

export async function addContact(ownerId: string, email: string): Promise<PublicContact> {
    const target = await User.findOne({ email }).select("name avatarId");

    if (!target) {
        throw new ContactTargetNotFoundError();
    }

    if (target.id === ownerId) {
        throw new CannotAddSelfError();
    }

    try {
        const contact = await Contact.create({ owner: ownerId, user: target._id });

        return { id: contact.id, name: target.name, avatarId: target.avatarId ?? null };
    } catch (error) {
        // La garantía final la da el índice único, no una comprobación previa.
        if (isDuplicateKeyError(error)) {
            throw new ContactAlreadyExistsError();
        }

        throw error;
    }
}

export async function removeContact(ownerId: string, contactId: string): Promise<void> {
    // Filtro por dueño: borrar el contacto de otro da el mismo "no encontrado" que uno inexistente.
    const result = await Contact.deleteOne({ _id: contactId, owner: ownerId });

    if (result.deletedCount === 0) {
        throw new ContactNotFoundError();
    }
}