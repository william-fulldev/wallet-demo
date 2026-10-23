import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import type { Movement } from "../api/types";
import { ActivityRow } from "./ActivityRow";

function createMovement(overrides: Partial<Movement>): Movement {
    return {
        id: "m-12345678",
        currency: "EUR",
        type: "transfer_in",
        amountCents: 1500,
        balanceAfterCents: 5000,
        createdAt: "2026-10-21T10:00:00.000Z",
        exchangeId: null,
        transferId: "tx-87654321",
        counterparty: null,
        note: null,
        asset: null,
        merchant: null,
        ...overrides,
    };
}

describe("ActivityRow", () => {
    it("transfer_in muestra Recibido de {nombre} y la nota en el subtítulo", () => {
        const movement = createMovement({
            type: "transfer_in",
            counterparty: { name: "Carlos", avatarId: "01" },
            note: "Alquiler piso",
        });

        render(<ActivityRow movement={movement} />);

        expect(screen.getByText("Recibido de Carlos")).toBeInTheDocument();
        expect(screen.getByText(/Alquiler piso/)).toBeInTheDocument();
    });

    it("transfer_out muestra Enviado a {nombre}", () => {
        const movement = createMovement({
            type: "transfer_out",
            counterparty: { name: "Beatriz", avatarId: null },
            note: "Cena",
        });

        render(<ActivityRow movement={movement} />);

        expect(screen.getByText("Enviado a Beatriz")).toBeInTheDocument();
        expect(screen.getByText(/Cena/)).toBeInTheDocument();
    });

    it("sin counterparty usa el respaldo de título", () => {
        const transferIn = createMovement({
            type: "transfer_in",
            counterparty: null,
        });
        const { unmount } = render(<ActivityRow movement={transferIn} />);
        expect(screen.getByText("Dinero recibido")).toBeInTheDocument();
        unmount();

        const transferOut = createMovement({
            type: "transfer_out",
            counterparty: null,
        });
        render(<ActivityRow movement={transferOut} />);
        expect(screen.getByText("Envío")).toBeInTheDocument();
    });

    it("sin nota no aparece la nota en el subtítulo", () => {
        const movement = createMovement({
            type: "transfer_in",
            counterparty: { name: "Carlos", avatarId: null },
            note: null,
        });

        render(<ActivityRow movement={movement} />);

        expect(screen.getByText("Recibido de Carlos")).toBeInTheDocument();
        expect(screen.queryByText(/·/)).not.toBeInTheDocument();
    });

    it("con onSelect renderiza un botón y al pulsarlo llama a onSelect con el movimiento", () => {
        const handleSelect = vi.fn();
        const movement = createMovement({
            type: "transfer_in",
            counterparty: { name: "Carlos", avatarId: null },
        });

        render(<ActivityRow movement={movement} onSelect={handleSelect} />);

        const btn = screen.getByRole("button");
        expect(btn).toBeInTheDocument();
        expect(btn).toHaveAttribute("aria-label");

        fireEvent.click(btn);
        expect(handleSelect).toHaveBeenCalledTimes(1);
        expect(handleSelect).toHaveBeenCalledWith(movement);
    });

    it("sin onSelect no hay botón", () => {
        const movement = createMovement({
            type: "transfer_in",
            counterparty: { name: "Carlos", avatarId: null },
        });

        render(<ActivityRow movement={movement} />);

        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
});
