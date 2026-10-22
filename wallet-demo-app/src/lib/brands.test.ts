import { describe, expect, it } from "vitest";
import { resolveBrand } from "./brands";

describe("resolveBrand", () => {
    const catalogWithIcons = [
        "netflix",
        "spotify",
        "starbucks",
        "zara",
        "uber",
        "apple",
        "BTC",
        "AAPL",
        "GOOGL",
        "TSLA",
    ];

    const catalogWithFallbacks = [
        "amazon",
        "AMZN",
        "MSFT",
    ];

    it.each(catalogWithIcons)(
        "resuelve la clave del catálogo %s con un SVG path válido",
        (key) => {
            const brand = resolveBrand(key);
            expect(brand.path).toBeTruthy();
            expect(typeof brand.path).toBe("string");
            expect(brand.hex).toBeTruthy();
            expect(brand.name).toBeTruthy();
        },
    );

    it.each(catalogWithFallbacks)(
        "resuelve la clave sin icono %s con texto de respaldo y sin path",
        (key) => {
            const brand = resolveBrand(key);
            expect(brand.path).toBeNull();
            expect(brand.fallbackText).toBeTruthy();
            expect(brand.hex).toBeTruthy();
            expect(brand.name).toBeTruthy();
        },
    );

    it("es insensible a mayúsculas y espacios en las claves", () => {
        expect(resolveBrand("  NETFLIX ").path).toBe(resolveBrand("netflix").path);
        expect(resolveBrand("btc").path).toBe(resolveBrand("BTC").path);
        expect(resolveBrand("msft").fallbackText).toBe("MSFT");
    });

    it("nunca falla con claves desconocidas o vacías", () => {
        const unknown = resolveBrand("desconocido_123", "Mi Tienda");
        expect(unknown.path).toBeNull();
        expect(unknown.name).toBe("Mi Tienda");
        expect(unknown.fallbackText).toBe("MT");

        const empty = resolveBrand("");
        expect(empty.path).toBeNull();
        expect(empty.name).toBeTruthy();
        expect(empty.fallbackText).toBeTruthy();

        const shortSymbol = resolveBrand("XYZ");
        expect(shortSymbol.fallbackText).toBe("XYZ");
    });
});
