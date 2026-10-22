// dates.ts
const formatter = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" });

export function formatDateTime(iso: string): string {
    return formatter.format(new Date(iso));
}
