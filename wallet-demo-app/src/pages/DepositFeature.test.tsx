import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import HomePage from "./HomePage";
import DepositPage from "./DepositPage";
import { BottomNav } from "../components/BottomNav";
import * as queries from "../api/queries";
import { ApiError } from "../api/client";
import { MemoryRouter } from "react-router-dom";

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
        useIonActionSheet: () => [vi.fn()],
        IonToast: ({
            isOpen,
            message,
        }: {
            isOpen: boolean;
            message: string;
            duration?: number;
            onDidDismiss?: () => void;
        }) => (isOpen ? <div data-testid="ion-toast">{message}</div> : null),
        IonPage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
        IonContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
        IonRefresher: () => null,
        IonRefresherContent: () => null,
        IonModal: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) =>
            isOpen ? <div>{children}</div> : null,
    };
});

vi.mock("../auth/AuthContext", () => ({
    useAuth: () => ({
        user: { id: "u-1", name: "Usuario Demo", email: "demo@wallet.demo", avatarId: "avatar-01" },
        logout: vi.fn(),
    }),
}));

function renderWithClient(ui: React.ReactElement) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return render(
        <MemoryRouter>
            <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
        </MemoryRouter>,
    );
}

describe("funcionalidad de desactivación de ingresos (Frontend)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Mock default queries for HomePage
        vi.spyOn(queries, "useAccounts").mockReturnValue({
            data: [
                { id: "acc-1", currency: "EUR", balanceCents: 50_000, updatedAt: "2026-01-01" },
                { id: "acc-2", currency: "USD", balanceCents: 50_000, updatedAt: "2026-01-01" },
                { id: "acc-3", currency: "BRL", balanceCents: 50_000, updatedAt: "2026-01-01" },
            ],
            isPending: false,
            isError: false,
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof queries.useAccounts>);

        vi.spyOn(queries, "useMovements").mockReturnValue({
            data: { pages: [{ movements: [] }] },
            isPending: false,
            isSuccess: true,
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof queries.useMovements>);

        vi.spyOn(queries, "useMarketAssets").mockReturnValue({
            data: [],
            isPending: false,
            isError: false,
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof queries.useMarketAssets>);

        vi.spyOn(queries, "useInvestments").mockReturnValue({
            data: [],
            isPending: false,
            isError: false,
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof queries.useInvestments>);
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    describe("HomePage: acción rápida Ingresar", () => {
        it("con ingresos desactivados, pulsar Ingresar muestra el aviso y no navega", () => {
            vi.spyOn(queries, "useFeatures").mockReturnValue({
                data: { depositsEnabled: false },
                isLoading: false,
                isPending: false,
            } as unknown as ReturnType<typeof queries.useFeatures>);

            const { container } = renderWithClient(<HomePage />);

            const depositTile = container.querySelector(".tile")!;
            expect(depositTile).toHaveAttribute("aria-disabled", "true");

            fireEvent.click(depositTile);

            expect(mockPush).not.toHaveBeenCalled();
            expect(screen.getByTestId("ion-toast")).toHaveTextContent("Ingresos desactivados en esta demo.");
        });

        it("con ingresos activados, pulsar Ingresar navega a /deposit", () => {
            vi.spyOn(queries, "useFeatures").mockReturnValue({
                data: { depositsEnabled: true },
                isLoading: false,
                isPending: false,
            } as unknown as ReturnType<typeof queries.useFeatures>);

            const { container } = renderWithClient(<HomePage />);

            const depositTile = container.querySelector(".tile")!;
            expect(depositTile).not.toHaveAttribute("aria-disabled");

            fireEvent.click(depositTile);

            expect(mockPush).toHaveBeenCalledWith("/deposit");
            expect(screen.queryByTestId("ion-toast")).toBeNull();
        });

        it("mientras carga la configuración, asume disabled y no navega", () => {
            vi.spyOn(queries, "useFeatures").mockReturnValue({
                data: undefined,
                isLoading: true,
                isPending: true,
            } as unknown as ReturnType<typeof queries.useFeatures>);

            const { container } = renderWithClient(<HomePage />);

            const depositTile = container.querySelector(".tile")!;
            expect(depositTile).toHaveAttribute("aria-disabled", "true");

            fireEvent.click(depositTile);

            expect(mockPush).not.toHaveBeenCalled();
            expect(screen.getByTestId("ion-toast")).toHaveTextContent("Ingresos desactivados en esta demo.");
        });
    });

    describe("BottomNav: botón Ingresar (+)", () => {
        it("con ingresos desactivados, pulsar Ingresar en la barra inferior muestra aviso y no navega", () => {
            vi.spyOn(queries, "useFeatures").mockReturnValue({
                data: { depositsEnabled: false },
                isLoading: false,
                isPending: false,
            } as unknown as ReturnType<typeof queries.useFeatures>);

            renderWithClient(<BottomNav />);

            const navDepositBtn = screen.getByRole("button", { name: /ingresar/i });
            expect(navDepositBtn).toHaveAttribute("aria-disabled", "true");

            fireEvent.click(navDepositBtn);

            expect(mockPush).not.toHaveBeenCalled();
            expect(screen.getByTestId("ion-toast")).toHaveTextContent("Ingresos desactivados en esta demo.");
        });

        it("con ingresos activados, pulsar Ingresar en la barra inferior navega a /deposit", () => {
            vi.spyOn(queries, "useFeatures").mockReturnValue({
                data: { depositsEnabled: true },
                isLoading: false,
                isPending: false,
            } as unknown as ReturnType<typeof queries.useFeatures>);

            renderWithClient(<BottomNav />);

            const navDepositBtn = screen.getByRole("button", { name: /ingresar/i });
            expect(navDepositBtn).not.toHaveAttribute("aria-disabled");

            fireEvent.click(navDepositBtn);

            expect(mockPush).toHaveBeenCalledWith("/deposit", "root", "replace");
        });
    });

    describe("DepositPage: vista de ingresos", () => {
        it("si se abre por URL con ingresos desactivados, muestra aviso y mantiene formulario desactivado", () => {
            vi.spyOn(queries, "useFeatures").mockReturnValue({
                data: { depositsEnabled: false },
                isLoading: false,
                isPending: false,
            } as unknown as ReturnType<typeof queries.useFeatures>);

            vi.spyOn(queries, "useDeposit").mockReturnValue({
                mutate: vi.fn(),
                isPending: false,
                error: null,
                reset: vi.fn(),
            } as unknown as ReturnType<typeof queries.useDeposit>);

            const { container } = renderWithClient(<DepositPage />);

            // Banner superior de aviso
            expect(
                screen.getByText(/los ingresos están desactivados en esta demo/i),
            ).toBeInTheDocument();

            // Formulario desactivado
            const amountInput = screen.getByPlaceholderText("0,00");
            expect(amountInput).toBeDisabled();

            const submitBtn = container.querySelector("button[type='submit']")!;
            expect(submitBtn).toBeDisabled();
        });

        it("el código DEPOSITS_DISABLED se muestra con su mensaje sin tratarlo como error genérico", () => {
            vi.spyOn(queries, "useFeatures").mockReturnValue({
                data: { depositsEnabled: false },
                isLoading: false,
                isPending: false,
            } as unknown as ReturnType<typeof queries.useFeatures>);

            const disabledError = new ApiError(
                403,
                "Los ingresos están desactivados en esta demo. Cada cuenta parte con 500 EUR, 500 USD y 500 BRL.",
                undefined,
                "DEPOSITS_DISABLED",
            );

            vi.spyOn(queries, "useDeposit").mockReturnValue({
                mutate: vi.fn(),
                isPending: false,
                error: disabledError,
                reset: vi.fn(),
            } as unknown as ReturnType<typeof queries.useDeposit>);

            renderWithClient(<DepositPage />);

            expect(
                screen.getAllByText(
                    "Los ingresos están desactivados en esta demo. Cada cuenta parte con 500 EUR, 500 USD y 500 BRL.",
                ).length,
            ).toBeGreaterThan(0);
        });
    });
});
