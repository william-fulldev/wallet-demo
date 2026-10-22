import React from "react";
import type { Holding, MarketAsset } from "../api/types";
import { formatMoney } from "../lib/money";
import { formatChangePct } from "../lib/units";
import { BrandIcon } from "./BrandIcon";

type Props = {
    marketAssets: MarketAsset[] | undefined;
    isPending: boolean;
    isError: boolean;
    error: Error | null;
    onRefetch: () => void;
    holdings: Holding[] | undefined;
    onSelectAsset: (asset: MarketAsset, initialMode?: "buy" | "sell") => void;
};

export const MarketCard: React.FC<Props> = ({
    marketAssets,
    isPending,
    isError,
    error,
    onRefetch,
    holdings,
    onSelectAsset,
}) => {
    // Cálculo del tiempo transcurrido desde la última actualización de precios
    const updatedMinutes = (() => {
        if (!marketAssets || marketAssets.length === 0) return 0;
        const times = marketAssets
            .map((a) => new Date(a.updatedAt).getTime())
            .filter((t) => !Number.isNaN(t));
        if (times.length === 0) return 0;
        const latest = Math.max(...times);
        return Math.max(0, Math.floor((Date.now() - latest) / 60_000));
    })();

    const updatedText = `Actualizado hace ${updatedMinutes} min`;

    const hasFallback = marketAssets?.some((a) => a.source === "fallback");
    const hasCache = marketAssets?.some((a) => a.source === "cache");
    const sourceBadge = hasFallback ? "Precios de ejemplo" : hasCache ? "Precios en caché" : null;

    return (
        <section className="glass panel market-card">
            <div className="panel-head market-head">
                <div className="market-head-info">
                    <h2>Invertir</h2>
                    <p className="panel-subtitle">Activos disponibles · Precios en USD</p>
                    <p className="market-updated-text">{updatedText}</p>
                </div>
                {sourceBadge && <span className="market-badge">{sourceBadge}</span>}
            </div>

            {isPending && (
                <div className="market-skeletons" aria-label="Cargando activos">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="asset-skeleton-row">
                            <div className="skeleton-icon" />
                            <div className="skeleton-text">
                                <div className="skeleton-line-long" />
                                <div className="skeleton-line-short" />
                            </div>
                            <div className="skeleton-right">
                                <div className="skeleton-line-medium" />
                                <div className="skeleton-line-short" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isError && (
                <div className="market-error-box">
                    <p>{error?.message || "No se pudieron cargar los precios de mercado."}</p>
                    <button type="button" className="link" onClick={onRefetch}>
                        Reintentar
                    </button>
                </div>
            )}

            {!isPending && !isError && marketAssets && (
                <div className="asset-list">
                    {marketAssets.map((asset) => {
                        const isUp = asset.changePct !== null && asset.changePct > 0;
                        const isDown = asset.changePct !== null && asset.changePct < 0;
                        const inPortfolio = holdings?.some(
                            (h) => h.symbol === asset.symbol && h.unitsE8 > 0,
                        );

                        return (
                            <button
                                key={asset.symbol}
                                type="button"
                                className="asset-row"
                                onClick={() => onSelectAsset(asset, "buy")}
                                aria-label={`Comprar ${asset.name}, precio ${formatMoney(asset.priceCents, "USD")}`}
                            >
                                <BrandIcon brandKey={asset.symbol} name={asset.name} size={40} />
                                <div className="asset-meta">
                                    <div className="asset-meta-title">
                                        <strong className="asset-name">{asset.name}</strong>
                                        {inPortfolio && (
                                            <span className="holding-badge">En cartera</span>
                                        )}
                                    </div>
                                    <span className="asset-symbol">{asset.symbol}</span>
                                </div>
                                <div className="asset-pricing">
                                    <span className="asset-price">
                                        {formatMoney(asset.priceCents, "USD")}
                                    </span>
                                    <span
                                        className={`asset-change ${isUp ? "change-up" : isDown ? "change-down" : "change-neutral"}`}
                                    >
                                        {isUp && "↑ "}
                                        {isDown && "↓ "}
                                        {formatChangePct(asset.changePct)}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </section>
    );
};
