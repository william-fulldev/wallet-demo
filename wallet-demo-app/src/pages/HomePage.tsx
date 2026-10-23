import { IonIcon, IonSpinner, IonToast, useIonActionSheet, useIonRouter } from "@ionic/react";
import {
    addOutline,
    closeOutline,
    listOutline,
    lockClosedOutline,
    notificationsOutline,
    paperPlaneOutline,
    searchOutline,
    swapHorizontalOutline,
} from "ionicons/icons";
import React, { useEffect, useRef, useState } from "react";
import {
    useAccounts,
    useFeatures,
    useInvestments,
    useMarketAssets,
    useMovements,
} from "../api/queries";
import type { Currency, MarketAsset, Movement } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { ActivityRow } from "../components/ActivityRow";
import { Avatar } from "../components/Avatar";
import { BuyInvestmentModal } from "../components/BuyInvestmentModal";
import { MarketCard } from "../components/MarketCard";
import { MovementDetailModal } from "../components/MovementDetailModal";
import { PortfolioCard } from "../components/PortfolioCard";
import { QuickTransfer } from "../components/QuickTransfer";
import { Screen } from "../components/Screen";
import { CURRENCY_SYMBOLS, formatMoney } from "../lib/money";

function ActionTile({
    icon,
    label,
    onClick,
    disabled = false,
    badgeIcon,
}: {
    icon: string;
    label: string;
    onClick: () => void;
    disabled?: boolean;
    badgeIcon?: string;
}) {
    return (
        <button
            type="button"
            className={`tile glass${disabled ? " tile--disabled" : ""}`}
            onClick={onClick}
            aria-disabled={disabled ? "true" : undefined}
        >
            <div className="tile-icon-wrapper">
                <IonIcon icon={icon} aria-hidden="true" />
                {badgeIcon && (
                    <span className="tile-lock-badge" aria-hidden="true">
                        <IonIcon icon={badgeIcon} />
                    </span>
                )}
            </div>
            <span>{label}</span>
        </button>
    );
}

const HomePage: React.FC = () => {
    const { user, logout } = useAuth();
    const router = useIonRouter();
    const [presentActionSheet] = useIonActionSheet();

    const accounts = useAccounts();
    const movements = useMovements();
    const marketAssets = useMarketAssets();
    const investments = useInvestments();
    const features = useFeatures();

    // Asume false mientras carga para no mostrar activo el botón por error
    const depositsEnabled = features.data?.depositsEnabled ?? false;
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const [selected, setSelected] = useState<Currency>("EUR");

    // Estado de la barra de búsqueda en cabecera
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchText, setSearchText] = useState("");
    const searchInputRef = useRef<HTMLInputElement>(null);
    const searchButtonRef = useRef<HTMLButtonElement>(null);

    // Estado del modal de inversión (compra y venta)
    const [selectedAsset, setSelectedAsset] = useState<MarketAsset | null>(null);
    const [investmentModalMode, setInvestmentModalMode] = useState<"buy" | "sell">("buy");
    const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);

    // Estado del modal de detalle de movimiento
    const [selectedMovement, setSelectedMovement] = useState<Movement | null>(null);

    useEffect(() => {
        if (isSearchOpen) {
            requestAnimationFrame(() => {
                searchInputRef.current?.focus();
            });
        }
    }, [isSearchOpen]);

    function openSearch() {
        setIsSearchOpen(true);
    }

    function closeSearch() {
        setIsSearchOpen(false);
        setSearchText("");
        searchButtonRef.current?.focus();
    }

    function handleUserMenu() {
        if (!user) return;
        void presentActionSheet({
            header: user.name,
            buttons: [
                {
                    text: "Cerrar sesión",
                    role: "destructive",
                    handler: () => void logout(),
                },
                {
                    text: "Cancelar",
                    role: "cancel",
                },
            ],
        });
    }

    function openInvestment(asset: MarketAsset, mode: "buy" | "sell" = "buy") {
        setSelectedAsset(asset);
        setInvestmentModalMode(mode);
        setIsBuyModalOpen(true);
    }

    // Si la cuenta elegida aún no existe en los datos, muestro la primera.
    const current = accounts.data?.find((account) => account.currency === selected) ?? accounts.data?.[0];
    const recent = movements.data?.pages[0]?.movements.slice(0, 4) ?? [];

    return (
        <Screen
            onRefresh={() =>
                Promise.all([
                    accounts.refetch(),
                    movements.refetch(),
                    marketAssets.refetch(),
                    investments.refetch(),
                ])
            }
        >
            <header className="topbar">
                <div className={`topbar-main${isSearchOpen ? " topbar-main--hidden" : ""}`}>
                    {user ? (
                        <button
                            type="button"
                            className="user-menu"
                            aria-label="Menú de usuario"
                            onClick={handleUserMenu}
                        >
                            <Avatar name={user.name} avatarId={user.avatarId} size={40} />
                        </button>
                    ) : (
                        <div className="avatar" aria-hidden="true">?</div>
                    )}
                    <div>
                        <p className="muted">Hola,</p>
                        <h1 className="topbar-name">{user?.name}</h1>
                    </div>

                    <div className="topbar-actions">
                        <button
                            type="button"
                            className="header-icon-btn header-bell"
                            aria-label="Notificaciones, 1 sin leer"
                        >
                            <IonIcon icon={notificationsOutline} aria-hidden="true" />
                            <span className="unread-dot" aria-hidden="true" />
                        </button>
                        <button
                            ref={searchButtonRef}
                            type="button"
                            className="header-icon-btn"
                            aria-label="Buscar"
                            aria-expanded={isSearchOpen}
                            onClick={openSearch}
                        >
                            <IonIcon icon={searchOutline} aria-hidden="true" />
                        </button>
                    </div>
                </div>

                <div
                    className={`topbar-search${isSearchOpen ? " topbar-search--open" : ""}`}
                    role="search"
                    aria-hidden={!isSearchOpen}
                >
                    <IonIcon icon={searchOutline} className="topbar-search-icon" aria-hidden="true" />
                    <input
                        ref={searchInputRef}
                        type="search"
                        className="topbar-search-input"
                        placeholder="Buscar movimientos, contactos, activos..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Escape") {
                                closeSearch();
                            }
                        }}
                        onBlur={() => {
                            if (searchText.trim() === "") {
                                closeSearch();
                            }
                        }}
                        tabIndex={isSearchOpen ? 0 : -1}
                    />
                    <button
                        type="button"
                        className="header-icon-btn"
                        aria-label="Cerrar búsqueda"
                        onClick={closeSearch}
                        tabIndex={isSearchOpen ? 0 : -1}
                    >
                        <IonIcon icon={closeOutline} aria-hidden="true" />
                    </button>
                </div>
            </header>

            {accounts.isPending && <IonSpinner />}

            {accounts.isError && (
                <div className="glass panel">
                    <p>{accounts.error.message}</p>
                    <button type="button" className="link" onClick={() => void accounts.refetch()}>
                        Reintentar
                    </button>
                </div>
            )}

            {accounts.data && (
                <div className="chips" role="tablist" aria-label="Cuentas">
                    {accounts.data.map((account) => {
                        const active = account.currency === current?.currency;

                        return (
                            <button
                                key={account.id}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                className={`chip glass${active ? " chip--active" : ""}`}
                                onClick={() => setSelected(account.currency)}
                            >
                                <span className="chip-symbol">{CURRENCY_SYMBOLS[account.currency]}</span>
                                <span>{formatMoney(account.balanceCents, account.currency)}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {current && (
                <section className="balance-block" aria-live="polite">
                    <p className="muted">Saldo en {current.currency}</p>
                    <p className="balance">{formatMoney(current.balanceCents, current.currency)}</p>
                </section>
            )}

            <div className="tiles">
                <ActionTile
                    icon={addOutline}
                    label="Ingresar"
                    onClick={() => {
                        if (!depositsEnabled) {
                            setToastMessage("Ingresos desactivados en esta demo.");
                            return;
                        }
                        router.push("/deposit");
                    }}
                    disabled={!depositsEnabled}
                    badgeIcon={!depositsEnabled ? lockClosedOutline : undefined}
                />
                <ActionTile icon={paperPlaneOutline} label="Enviar" onClick={() => router.push("/send")} />
                <ActionTile icon={swapHorizontalOutline} label="Cambiar" onClick={() => router.push("/exchange")} />
                <ActionTile icon={listOutline} label="Movimientos" onClick={() => router.push("/movements")} />
            </div>

            <QuickTransfer />

            <section className="glass panel">
                <div className="panel-head">
                    <h2>Actividad reciente</h2>
                    <button type="button" className="link" onClick={() => router.push("/movements")}>
                        Ver todo
                    </button>
                </div>

                {movements.isSuccess && recent.length === 0 && <p className="muted">Aún no hay movimientos.</p>}

                <ul className="activity">
                    {recent.map((movement) => (
                        <ActivityRow
                            key={movement.id}
                            movement={movement}
                            onSelect={(m) => setSelectedMovement({ ...m })}
                        />
                    ))}
                </ul>
            </section>

            {/* 1. Tarjeta Tu Cartera */}
            <PortfolioCard
                holdings={investments.data}
                isPending={investments.isPending}
                isError={investments.isError}
                error={investments.error}
                onRefetch={() => void investments.refetch()}
                marketAssets={marketAssets.data}
                onSelectAsset={(asset, mode) => openInvestment(asset, mode ?? "sell")}
            />

            {/* 2. Tarjeta Invertir (Activos disponibles) */}
            <MarketCard
                marketAssets={marketAssets.data}
                isPending={marketAssets.isPending}
                isError={marketAssets.isError}
                error={marketAssets.error}
                onRefetch={() => void marketAssets.refetch()}
                holdings={investments.data}
                onSelectAsset={(asset, mode) => openInvestment(asset, mode ?? "buy")}
            />

            {/* Modal de compra y venta */}
            <BuyInvestmentModal
                isOpen={isBuyModalOpen}
                asset={selectedAsset}
                initialMode={investmentModalMode}
                onClose={() => {
                    setIsBuyModalOpen(false);
                    setSelectedAsset(null);
                }}
            />

            {/* Modal de detalle del movimiento */}
            <MovementDetailModal
                isOpen={!!selectedMovement}
                movement={selectedMovement}
                onClose={() => setSelectedMovement(null)}
            />

            <IonToast
                isOpen={!!toastMessage}
                message={toastMessage ?? ""}
                duration={3000}
                onDidDismiss={() => setToastMessage(null)}
            />
        </Screen>
    );
};

export default HomePage;
