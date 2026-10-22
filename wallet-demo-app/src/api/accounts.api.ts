import { apiRequest } from "./client";
import type {
    Account, AccountChange, Currency, ExchangeResult, MovementsPage,
} from "./types";

export async function fetchAccounts(): Promise<Account[]> {
    const data = await apiRequest<{ accounts: Account[] }>("/api/accounts");
    return data.accounts;
}

type MovementsParams = {
    before?: string | undefined;
    currency?: Currency | undefined;
    limit?: number | undefined;
};

export function fetchMovements(params: MovementsParams): Promise<MovementsPage> {
    // URLSearchParams codifica los valores correctamente; no concateno texto a mano.
    const search = new URLSearchParams();

    if (params.before) search.set("before", params.before);
    if (params.currency) search.set("currency", params.currency);
    if (params.limit) search.set("limit", String(params.limit));

    const query = search.toString();
    return apiRequest<MovementsPage>(`/api/accounts/movements${query ? `?${query}` : ""}`);
}

export function deposit(currency: Currency, amountCents: number): Promise<AccountChange> {
    return apiRequest<AccountChange>(`/api/accounts/${currency}/deposit`, {
        method: "POST",
        body: { amountCents },
    });
}

export function exchange(input: {
    from: Currency;
    to: Currency;
    amountCents: number;
}): Promise<ExchangeResult> {
    return apiRequest<ExchangeResult>("/api/accounts/exchange", {
        method: "POST",
        body: input,
    });
}
