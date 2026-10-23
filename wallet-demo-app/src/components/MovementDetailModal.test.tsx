import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import type { Movement } from "../api/types";
import { MovementDetailModal } from "./MovementDetailModal";

vi.mock("@ionic/react", async () => {
    const actual = await vi.importActual("@ionic/react");
    return {
        ...actual,
        IonModal: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) =>
            isOpen ? <div data-testid="detail-modal">{children}</div> : null,
        IonHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
        IonToolbar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
        IonTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
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
        IonContent: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
        IonIcon: () => <span aria-hidden="true" />,
    };
});

function createMovement(overrides: Partial<Movement>): Movement {
    return {
        id: "m-abcdef12345678",
        currency: "EUR",
        type: "transfer_in",
        amountCents: 2500, // 25,00 €
        balanceAfterCents: 10000, // 100,00 €
        createdAt: "2026-10-21T10:00:00.000Z",
        exchangeId: null,
        transferId: "tx-1234567890",
        counterparty: { name: "Laura Ramos", avatarId: "02" },
        note: "Regalo de cumpleaños",
        asset: null,
        merchant: null,
        ...overrides,
    };
}

describe("MovementDetailModal", () => {
    it("muestra remitente, nota, importe con signo y saldo", () => {
        const movement = createMovement({
            type: "transfer_in",
            amountCents: 2500,
            balanceAfterCents: 10000,
            counterparty: { name: "Laura Ramos", avatarId: "02" },
            note: "Regalo de cumpleaños",
        });

        render(<MovementDetailModal isOpen={true} movement={movement} onClose={vi.fn()} />);

        // Remitente (en título y en sección De)
        expect(screen.getByText("Recibido de Laura Ramos")).toBeInTheDocument();
        expect(screen.getByText("Laura Ramos")).toBeInTheDocument();

        // Nota
        expect(screen.getByText("Regalo de cumpleaños")).toBeInTheDocument();

        // Importe con signo (+25,00 €)
        expect(screen.getByText("+25,00 €")).toBeInTheDocument();

        // Saldo tras la operación (100,00 €)
        expect(screen.getByText("100,00 €")).toBeInTheDocument();

        // Referencia
        expect(screen.getByText("34567890")).toBeInTheDocument();
    });

    it("oculta el bloque de nota si no hay", () => {
        const movement = createMovement({
            note: null,
        });

        render(<MovementDetailModal isOpen={true} movement={movement} onClose={vi.fn()} />);

        expect(screen.queryByText("Nota")).not.toBeInTheDocument();
    });

    it("una nota con etiquetas HTML se muestra como texto literal", () => {
        const rawNote = "<b>hola</b> <script>alert(1)</script>";
        const movement = createMovement({
            note: rawNote,
        });

        render(<MovementDetailModal isOpen={true} movement={movement} onClose={vi.fn()} />);

        const noteElement = screen.getByText(rawNote);
        expect(noteElement).toBeInTheDocument();
        // Verificar que no se interpretó como elemento <b> o <script>
        expect(noteElement.querySelector("b")).toBeNull();
        expect(noteElement.querySelector("script")).toBeNull();
        expect(noteElement.textContent).toBe(rawNote);
    });

    it("cierra al pedirlo mediante el botón de cierre", () => {
        const handleClose = vi.fn();
        const movement = createMovement({});

        render(<MovementDetailModal isOpen={true} movement={movement} onClose={handleClose} />);

        const closeBtn = screen.getByLabelText("Cerrar modal");
        fireEvent.click(closeBtn);

        expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it("cierra al presionar la tecla Escape", () => {
        const handleClose = vi.fn();
        const movement = createMovement({});

        render(<MovementDetailModal isOpen={true} movement={movement} onClose={handleClose} />);

        fireEvent.keyDown(window, { key: "Escape" });

        expect(handleClose).toHaveBeenCalledTimes(1);
    });
});
