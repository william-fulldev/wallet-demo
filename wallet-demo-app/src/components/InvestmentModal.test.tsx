import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BuyInvestmentModal } from "./BuyInvestmentModal";
import { PortfolioCard } from "./PortfolioCard";
import { MarketCard } from "./MarketCard";
import * as queries from "../api/queries";
import type { Holding, MarketAsset } from "../api/types";

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
            isOpen ? <div data-testid="investment-modal">{children}</div> : null,
        IonHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
        IonToolbar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
        IonTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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
        IonSpinner: () => <span>cargando...</span>,
        IonIcon: () => <span aria-hidden="true" />,
    };
});

const AAPL_ASSET: MarketAsset = {
    symbol: "AAPL",
    name: "Apple",
    kind: "stock",
    priceCents: 20_000, // 200,00 USD
    changePct: 1.5,
    source: "live",
    updatedAt: new Date().toISOString(),
};

const AAPL_HOLDING: Holding = {
    symbol: "AAPL",
    name: "Apple",
    unitsE8: 50_000_000, // 0.5 unidades -> valor 100,00 USD (10.000 céntimos)
    investedCents: 10_000,
    valueCents: 10_000,
    pnlCents: 0,
};

function renderWithClient(ui: React.ReactElement) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("Modal de inversión (compra y venta) y tarjetas de activación", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Mock de cuentas con saldo en USD
        vi.spyOn(queries, "useAccounts").mockReturnValue({
            data: [
                { id: "acc-1", currency: "USD", balanceCents: 50_000, updatedAt: "" },
            ],
            isPending: false,
            isError: false,
            error: null,
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof queries.useAccounts>);

        // Mock de mutaciones
        vi.spyOn(queries, "useBuyInvestment").mockReturnValue({
            mutate: vi.fn(),
            reset: vi.fn(),
            isPending: false,
            isError: false,
            error: null,
        } as unknown as ReturnType<typeof queries.useBuyInvestment>);

        vi.spyOn(queries, "useSellInvestment").mockReturnValue({
            mutate: vi.fn(),
            reset: vi.fn(),
            isPending: false,
            isError: false,
            error: null,
        } as unknown as ReturnType<typeof queries.useSellInvestment>);
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it("pestaña 'Vender' está desactivada cuando el usuario no tiene posición en ese activo", () => {
        // Sin holdings
        vi.spyOn(queries, "useInvestments").mockReturnValue({
            data: [],
            isPending: false,
            isError: false,
            error: null,
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof queries.useInvestments>);

        renderWithClient(
            <BuyInvestmentModal
                isOpen={true}
                asset={AAPL_ASSET}
                initialMode="buy"
                onClose={vi.fn()}
            />,
        );

        const sellTabBtn = screen.getByRole("tab", { name: /vender/i });
        expect(sellTabBtn).toBeDisabled();

        const buyTabBtn = screen.getByRole("tab", { name: /comprar/i });
        expect(buyTabBtn).not.toBeDisabled();
    });

    it("pestaña 'Vender' está habilitada cuando el usuario posee unidades", () => {
        vi.spyOn(queries, "useInvestments").mockReturnValue({
            data: [AAPL_HOLDING],
            isPending: false,
            isError: false,
            error: null,
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof queries.useInvestments>);

        renderWithClient(
            <BuyInvestmentModal
                isOpen={true}
                asset={AAPL_ASSET}
                initialMode="buy"
                onClose={vi.fn()}
            />,
        );

        const sellTabBtn = screen.getByRole("tab", { name: /vender/i });
        expect(sellTabBtn).not.toBeDisabled();
    });

    it("al abrir desde 'Tu cartera' (initialMode='sell'), se abre en la pestaña 'Vender' mostrando unidades y valor", () => {
        vi.spyOn(queries, "useInvestments").mockReturnValue({
            data: [AAPL_HOLDING],
            isPending: false,
            isError: false,
            error: null,
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof queries.useInvestments>);

        renderWithClient(
            <BuyInvestmentModal
                isOpen={true}
                asset={AAPL_ASSET}
                initialMode="sell"
                onClose={vi.fn()}
            />,
        );

        const sellTabBtn = screen.getByRole("tab", { name: /vender/i });
        expect(sellTabBtn).toHaveAttribute("aria-selected", "true");

        // Debe mostrar la posición del usuario: 0,5 AAPL (100,00 US$)
        expect(screen.getByText(/0,5 AAPL/i)).toBeInTheDocument();
        expect(screen.getByText(/100,00\s*(USD|US\$)/i)).toBeInTheDocument();
    });

    it("botón 'Vender todo' rellena el valor total de la posición", () => {
        vi.spyOn(queries, "useInvestments").mockReturnValue({
            data: [AAPL_HOLDING],
            isPending: false,
            isError: false,
            error: null,
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof queries.useInvestments>);

        renderWithClient(
            <BuyInvestmentModal
                isOpen={true}
                asset={AAPL_ASSET}
                initialMode="sell"
                onClose={vi.fn()}
            />,
        );

        const input = screen.getByLabelText(/importe a vender en usd/i) as HTMLInputElement;
        expect(input.value).toBe("");

        const sellAllBtn = screen.getByRole("button", { name: /vender todo/i });
        fireEvent.click(sellAllBtn);

        // Rellena 100,00 (el valor total de 0.5 unidades a 200 USD)
        expect(input.value).toBe("100,00");
    });

    it("PortfolioCard invoca onSelectAsset con initialMode='sell'", () => {
        const onSelectAsset = vi.fn();

        render(
            <PortfolioCard
                holdings={[AAPL_HOLDING]}
                isPending={false}
                isError={false}
                error={null}
                onRefetch={vi.fn()}
                marketAssets={[AAPL_ASSET]}
                onSelectAsset={onSelectAsset}
            />,
        );

        const itemBtn = screen.getByRole("button", { name: /gestionar o vender/i });
        fireEvent.click(itemBtn);

        expect(onSelectAsset).toHaveBeenCalledTimes(1);
        expect(onSelectAsset).toHaveBeenCalledWith(AAPL_ASSET, "sell");
    });

    it("MarketCard invoca onSelectAsset con initialMode='buy'", () => {
        const onSelectAsset = vi.fn();

        render(
            <MarketCard
                marketAssets={[AAPL_ASSET]}
                isPending={false}
                isError={false}
                error={null}
                onRefetch={vi.fn()}
                holdings={[AAPL_HOLDING]}
                onSelectAsset={onSelectAsset}
            />,
        );

        const assetBtn = screen.getByRole("button", { name: /comprar apple/i });
        fireEvent.click(assetBtn);

        expect(onSelectAsset).toHaveBeenCalledTimes(1);
        expect(onSelectAsset).toHaveBeenCalledWith(AAPL_ASSET, "buy");
    });
});
