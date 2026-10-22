import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAccounts, fetchMovements, deposit, exchange } from "./accounts.api";
import type { Currency } from "./types";
import { sendTransfer } from "./transfers.api";
import { addContact, fetchContacts, removeContact } from "./contacts.api";

import { fetchMarketAssets, fetchInvestments, buyInvestment, sellInvestment } from "./investments.api";
import { apiRequest } from "./client";
import type { FeaturesConfig } from "./types";

export const queryKeys = {
    accounts: ["accounts"] as const,
    movements: ["movements"] as const,
    contacts: ["contacts"] as const,
    market: ["market"] as const,
    investments: ["investments"] as const,
    features: ["features"] as const,
};

export async function fetchFeatures(): Promise<FeaturesConfig> {
    return apiRequest<FeaturesConfig>("/api/config/features", { auth: false });
}

export function useFeatures() {
    return useQuery({
        queryKey: queryKeys.features,
        queryFn: fetchFeatures,
        staleTime: 60 * 60 * 1000, // StaleTime largo para evitar peticiones redundantes
    });
}

const PAGE_SIZE = 20;

export function useAccounts() {
    return useQuery({ queryKey: queryKeys.accounts, queryFn: fetchAccounts });
}

export function useMovements(currency?: Currency) {
    return useInfiniteQuery({
        // Cada filtro tiene su propia caché.
        queryKey: [...queryKeys.movements, currency ?? "all"],
        queryFn: ({ pageParam }) =>
            fetchMovements({ before: pageParam, currency, limit: PAGE_SIZE }),
        initialPageParam: undefined as string | undefined,
        // Sin cursor siguiente no hay más páginas: undefined detiene la carga.
        getNextPageParam: (lastPage) => lastPage.nextBefore ?? undefined,
    });
}

// Tras mover dinero, saldos e historial quedan obsoletos: los marco para recargar.
function useRefreshMoneyData() {
    const queryClient = useQueryClient();

    return () =>
        Promise.all([
            queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
            queryClient.invalidateQueries({ queryKey: queryKeys.movements }),
        ]);
}

export function useDeposit() {
    const refresh = useRefreshMoneyData();

    return useMutation({
        mutationFn: (input: { currency: Currency; amountCents: number }) =>
            deposit(input.currency, input.amountCents),
        // Devolver la promesa hace que la mutación no termine hasta tener datos frescos.
        onSuccess: refresh,
    });
}

export function useExchange() {
    const refresh = useRefreshMoneyData();

    return useMutation({
        mutationFn: exchange,
        onSuccess: refresh,
    });
}

export function useContacts() {
    return useQuery({ queryKey: queryKeys.contacts, queryFn: fetchContacts });
}

export function useAddContact() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: addContact,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.contacts }),
    });
}

export function useRemoveContact() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: removeContact,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.contacts }),
    });
}

// Un envío mueve saldos e historial, y actualiza los contactos recientes: los marco para recargar.
export function useSendTransfer() {
    const refresh = useRefreshMoneyData();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: sendTransfer,
        onSuccess: () =>
            Promise.all([
                refresh(),
                queryClient.invalidateQueries({ queryKey: queryKeys.contacts }),
            ]),
    });
}

export function useMarketAssets() {
    return useQuery({
        queryKey: queryKeys.market,
        queryFn: fetchMarketAssets,
        staleTime: 30_000,
        refetchInterval: 60_000,
        refetchIntervalInBackground: false,
    });
}

export function useInvestments() {
    return useQuery({
        queryKey: queryKeys.investments,
        queryFn: fetchInvestments,
    });
}

export function useBuyInvestment() {
    const refresh = useRefreshMoneyData();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: buyInvestment,
        onSuccess: () =>
            Promise.all([
                refresh(),
                queryClient.invalidateQueries({ queryKey: queryKeys.investments }),
            ]),
    });
}

export function useSellInvestment() {
    const refresh = useRefreshMoneyData();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: sellInvestment,
        onSuccess: () =>
            Promise.all([
                refresh(),
                queryClient.invalidateQueries({ queryKey: queryKeys.investments }),
            ]),
    });
}


