import React from "react";
import type { Holding, MarketAsset } from "../api/types";
import { formatMoney } from "../lib/money";
import { summarizePortfolio } from "../lib/portfolio";
import { formatChangePct, formatUnits } from "../lib/units";
import { BrandIcon } from "./BrandIcon";

type Props = {
    holdings: Holding[] | undefined;
    isPending: boolean;
    isError: boolean;
    error: Error | null;
    onRefetch: () => void;
    marketAssets: MarketAsset[] | undefined;
    onSelectAsset: (asset: MarketAsset, initialMode?: "buy" | "sell") => void;
};

export const PortfolioCard: React.FC<Props> = ({
    holdings,
    isPending,
    isError,
    error,
    onRefetch,
    marketAssets,
    onSelectAsset,
}) => {
    const summary = summarizePortfolio(holdings ?? []);
    const hasPositions = holdings && holdings.length > 0;

    const isUp = summary.totalPnlCents > 0;
    const isDown = summary.totalPnlCents < 0;
    const pnlClass = isUp ? "pnl-up" : isDown ? "pnl-down" : "pnl-neutral";

    return (
        <section className="glass panel portfolio-card">
            <div className="panel-head portfolio-head">
                <div>
                    <h2>Tu cartera</h2>
                    {hasPositions && (
                        <p className={`panel-subtitle ${pnlClass}`}>
                            {summary.totalPnlCents > 0 ? "+" : ""}
                            {formatMoney(summary.totalPnlCents, "USD")}
                            {summary.pnlPct !== null && ` (${formatChangePct(summary.pnlPct)})`}
                        </p>
                    )}
                </div>
                {hasPositions && (
                    <div className="portfolio-total-figure">
                        <span className="portfolio-total-val">
                            {formatMoney(summary.totalValueCents, "USD")}
                        </span>
                    </div>
                )}
            </div>

            {isPending && (
                <div className="portfolio-skeletons" aria-label="Cargando cartera">
                    {[1, 2].map((i) => (
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
                <div className="portfolio-error-box">
                    <p>{error?.message || "No se pudo cargar la cartera."}</p>
                    <button type="button" className="link" onClick={onRefetch}>
                        Reintentar
                    </button>
                </div>
            )}

            {!isPending && !isError && !hasPositions && (
                <p className="portfolio-empty-msg">
                    Todavía no tienes inversiones. Elige un activo de la lista de abajo para empezar.
                </p>
            )}

            {!isPending && !isError && hasPositions && (
                <div className="portfolio-items-list">
                    {holdings.map((pos) => {
                        const posUp = pos.pnlCents > 0;
                        const posDown = pos.pnlCents < 0;
                        const marketAsset = marketAssets?.find((a) => a.symbol === pos.symbol);

                        const content = (
                            <>
                                <BrandIcon brandKey={pos.symbol} name={pos.name} size={40} />
                                <div className="portfolio-item-meta">
                                    <strong className="portfolio-item-name">{pos.name}</strong>
                                    <span className="portfolio-item-units">
                                        {formatUnits(pos.unitsE8)} {pos.symbol}
                                    </span>
                                </div>
                                <div className="portfolio-item-figures">
                                    <span className="portfolio-item-val">
                                        {formatMoney(pos.valueCents, "USD")}
                                    </span>
                                    <span
                                        className={`portfolio-item-pnl ${posUp ? "pnl-up" : posDown ? "pnl-down" : "pnl-neutral"}`}
                                    >
                                        {pos.pnlCents > 0 ? "+" : ""}
                                        {formatMoney(pos.pnlCents, "USD")}
                                    </span>
                                </div>
                            </>
                        );

                        if (marketAsset) {
                            return (
                                <button
                                    key={pos.symbol}
                                    type="button"
                                    className="portfolio-item portfolio-item--actionable"
                                    onClick={() => onSelectAsset(marketAsset, "sell")}
                                    aria-label={`Gestionar o vender ${pos.name}, valor actual ${formatMoney(pos.valueCents, "USD")}`}
                                >
                                    {content}
                                </button>
                            );
                        }

                        return (
                            <div key={pos.symbol} className="portfolio-item">
                                {content}
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
};
