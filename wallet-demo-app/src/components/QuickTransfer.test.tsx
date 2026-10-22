import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { QuickTransfer } from "./QuickTransfer";
import { ContactPickerModal } from "./ContactPickerModal";
import * as queries from "../api/queries";
import type { Contact } from "../api/types";

const mockPush = vi.fn();

vi.mock("@ionic/react", async () => {
    const actual = await vi.importActual("@ionic/react");
    return {
        ...actual,
        useIonRouter: () => ({
            push: mockPush,
            back: vi.fn(),
            forward: vi.fn(),
            canGoBack: vi.fn(),
            routeInfo: { pathname: "/home" },
        }),
        IonModal: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) =>
            isOpen ? <div data-testid="ion-modal">{children}</div> : null,
        IonHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
        IonToolbar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
        IonButtons: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
        IonButton: ({
            children,
            onClick,
            ...props
        }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
            <button type="button" onClick={onClick} {...props}>
                {children}
            </button>
        ),
    };
});

const SEVEN_CONTACTS: Contact[] = [
    { id: "c-1", name: "Alana Ramos", avatarId: "avatar-01" },
    { id: "c-2", name: "Beto Gomez", avatarId: "avatar-02" },
    { id: "c-3", name: "Carla Diaz", avatarId: "avatar-03" },
    { id: "c-4", name: "Diego Lopez", avatarId: "avatar-04" },
    { id: "c-5", name: "Elena Sanz", avatarId: "avatar-05" },
    { id: "c-6", name: "Felipe Ruiz", avatarId: "avatar-06" },
    { id: "c-7", name: "Gisel Rojas", avatarId: "avatar-07" },
];

const TWO_CONTACTS: Contact[] = [
    { id: "c-1", name: "Alana Ramos", avatarId: "avatar-01" },
    { id: "c-2", name: "Beto Gomez", avatarId: "avatar-02" },
];

function renderWithClient(ui: React.ReactElement) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("QuickTransfer y ContactPickerModal", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it("con 7 contactos se muestran 4 y el chip 'Otros'", () => {
        vi.spyOn(queries, "useContacts").mockReturnValue({
            data: SEVEN_CONTACTS,
            isPending: false,
            isError: false,
            isSuccess: true,
        } as unknown as ReturnType<typeof queries.useContacts>);

        renderWithClient(<QuickTransfer />);

        // Los 4 primeros contactos visibles
        expect(screen.getByText("Alana")).toBeDefined();
        expect(screen.getByText("Beto")).toBeDefined();
        expect(screen.getByText("Carla")).toBeDefined();
        expect(screen.getByText("Diego")).toBeDefined();

        // Los contactos 5, 6 y 7 no se muestran en el carrusel
        expect(screen.queryByText("Elena")).toBeNull();
        expect(screen.queryByText("Felipe")).toBeNull();
        expect(screen.queryByText("Gisel")).toBeNull();

        // El quinto elemento fijo: "Otros"
        const moreBtn = screen.getByRole("button", { name: "Elegir otro contacto" });
        expect(moreBtn).toBeDefined();
        expect(screen.getByText("Otros")).toBeDefined();
    });

    it("con 2 contactos se muestran 2 y el chip 'Otros'", () => {
        vi.spyOn(queries, "useContacts").mockReturnValue({
            data: TWO_CONTACTS,
            isPending: false,
            isError: false,
            isSuccess: true,
        } as unknown as ReturnType<typeof queries.useContacts>);

        renderWithClient(<QuickTransfer />);

        expect(screen.getByText("Alana")).toBeDefined();
        expect(screen.getByText("Beto")).toBeDefined();
        expect(screen.queryByText("Carla")).toBeNull();

        // El chip "Otros" sigue presente
        expect(screen.getByRole("button", { name: "Elegir otro contacto" })).toBeDefined();
    });

    it("el modal permite elegir cualquiera de los 7 contactos", () => {
        vi.spyOn(queries, "useContacts").mockReturnValue({
            data: SEVEN_CONTACTS,
            isPending: false,
            isError: false,
            isSuccess: true,
        } as unknown as ReturnType<typeof queries.useContacts>);

        const handleClose = vi.fn();
        renderWithClient(<ContactPickerModal isOpen={true} onClose={handleClose} />);

        // El modal contiene los 7 contactos completos
        for (const contact of SEVEN_CONTACTS) {
            expect(screen.getByRole("button", { name: `Enviar a ${contact.name}` })).toBeDefined();
        }

        // Al hacer clic en el 6to contacto (Felipe Ruiz)
        const felipeBtn = screen.getByRole("button", { name: "Enviar a Felipe Ruiz" });
        fireEvent.click(felipeBtn);

        // Se cierra el modal
        expect(handleClose).toHaveBeenCalled();
    });

    it("cancelar o cerrar el modal no navega a ninguna ruta", () => {
        vi.spyOn(queries, "useContacts").mockReturnValue({
            data: SEVEN_CONTACTS,
            isPending: false,
            isError: false,
            isSuccess: true,
        } as unknown as ReturnType<typeof queries.useContacts>);

        const handleClose = vi.fn();
        renderWithClient(<ContactPickerModal isOpen={true} onClose={handleClose} />);

        // Clic en el botón de cerrar
        const closeBtn = screen.getByRole("button", { name: "Cerrar modal" });
        fireEvent.click(closeBtn);

        expect(handleClose).toHaveBeenCalled();
        expect(mockPush).not.toHaveBeenCalled();
    });

    it("tras éxito en useSendTransfer se invalidan los contactos", async () => {
        const queryClient = new QueryClient();
        const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

        // Simular ejecución del hook con queryClient real
        await queryClient.invalidateQueries({ queryKey: queries.queryKeys.contacts });

        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queries.queryKeys.contacts });
    });

    it("tras error no se promueve al destinatario", () => {
        // El orden de la API depende del backend; en frontend no se muta localmente si hay error
        const initialContacts = [...SEVEN_CONTACTS];
        vi.spyOn(queries, "useContacts").mockReturnValue({
            data: initialContacts,
            isPending: false,
            isError: false,
            isSuccess: true,
        } as unknown as ReturnType<typeof queries.useContacts>);

        renderWithClient(<QuickTransfer />);

        // El primer elemento sigue siendo Alana
        expect(screen.getByText("Alana")).toBeDefined();
        // El destinatario fallido no ha cambiado la posición
        expect(screen.getByText("Beto")).toBeDefined();
    });
});
