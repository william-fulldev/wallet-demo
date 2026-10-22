import { IonSpinner } from "@ionic/react";
import { useState } from "react";
import { useMovements } from "../api/queries";
import { CURRENCIES, type Currency } from "../api/types";
import { ActivityRow } from "../components/ActivityRow";
import { PageHeader } from "../components/PageHeader";
import { Screen } from "../components/Screen";

type Filter = Currency | "ALL";

const FILTERS: Filter[] = ["ALL", ...CURRENCIES];

const MovementsPage: React.FC = () => {
    const [filter, setFilter] = useState<Filter>("ALL");
    const query = useMovements(filter === "ALL" ? undefined : filter);

    // Cada página trae su lista; las uno en una sola.
    const movements = query.data?.pages.flatMap((page) => page.movements) ?? [];

    return (
        <Screen onRefresh={() => query.refetch()}>
            <PageHeader title="Movimientos" />

            <div className="chips" role="tablist" aria-label="Filtrar por moneda">
                {FILTERS.map((option) => {
                    const active = option === filter;

                    return (
                        <button
                            key={option}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            className={`chip chip--filter glass${active ? " chip--active" : ""}`}
                            onClick={() => setFilter(option)}
                        >
                            {option === "ALL" ? "Todas" : option}
                        </button>
                    );
                })}
            </div>

            <section className="glass panel">
                {query.isPending && <IonSpinner />}

                {query.isError && (
                    <>
                        <p>{query.error.message}</p>
                        <button type="button" className="link" onClick={() => void query.refetch()}>
                            Reintentar
                        </button>
                    </>
                )}

                {query.isSuccess && movements.length === 0 && <p className="muted">Aún no hay movimientos.</p>}

                <ul className="activity">
                    {movements.map((movement) => (
                        <ActivityRow key={movement.id} movement={movement} showBalance />
                    ))}
                </ul>

                {query.hasNextPage && (
                    <button
                        type="button"
                        className="link load-more"
                        disabled={query.isFetchingNextPage}
                        onClick={() => void query.fetchNextPage()}
                    >
                        {query.isFetchingNextPage ? "Cargando…" : "Cargar más"}
                    </button>
                )}
            </section>
        </Screen>
    );
};

export default MovementsPage;
