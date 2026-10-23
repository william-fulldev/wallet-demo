// dates.ts
const formatter = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" });
const fullFormatter = new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeStyle: "short" });

export function formatDateTime(iso: string): string {
    return formatter.format(new Date(iso));
}

export function formatFullDateTime(iso: string): string {
    return fullFormatter.format(new Date(iso));
}
