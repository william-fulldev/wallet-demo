import { calculateHoldingValueCents, estimateSellUnitsE8, estimateUnitsE8, formatChangePct, formatUnits } from "./units";

describe("formatUnits", () => {
    it("formatea 0 unidades", () => {
        expect(formatUnits(0)).toBe("0");
    });

    it("formatea la unidad mínima (1 satoshi / 1e-8)", () => {
        expect(formatUnits(1)).toBe("0,00000001");
    });

    it("formatea fracciones intermedias sin ceros sobrantes", () => {
        // 0.5 unidades
        expect(formatUnits(50_000_000)).toBe("0,5");
        // 0.12345678 unidades
        expect(formatUnits(12_345_678)).toBe("0,12345678");
        // 0.0001 unidades
        expect(formatUnits(10_000)).toBe("0,0001");
    });

    it("formatea enteros exactos sin decimales", () => {
        expect(formatUnits(100_000_000)).toBe("1");
        expect(formatUnits(2500_000_000)).toBe("25");
    });

    it("formatea compras típicas de Bitcoin (fraccionadas)", () => {
        // Compra de 50 $ con BTC a 65.000 $: Math.floor(5000 * 1e8 / 6500000) = 76.923 satoshis
        const btcUnits = estimateUnitsE8(50_00, 65_000_00);
        expect(btcUnits).toBe(76_923);
        expect(formatUnits(btcUnits)).toBe("0,00076923");
    });

    it("formatea compras típicas de acciones (fraccionadas)", () => {
        // Compra de 100 $ con AAPL a 230,00 $: Math.floor(10000 * 1e8 / 23000) = 43.478.260
        const stockUnits = estimateUnitsE8(100_00, 230_00);
        expect(stockUnits).toBe(43_478_260);
        expect(formatUnits(stockUnits)).toBe("0,4347826");
    });

    it("maneja valores negativos y límites", () => {
        expect(formatUnits(-100_000_000)).toBe("-1");
        expect(formatUnits(-50_000_000)).toBe("-0,5");
        expect(formatUnits(Number.NaN)).toBe("0");
    });
});

describe("estimateUnitsE8", () => {
    it("coincide con la fórmula entera del backend para Bitcoin", () => {
        // 100 USD (10.000 céntimos) a 67.420 USD (6.742.000 céntimos)
        const amountCents = 10_000;
        const priceCents = 6_742_000;
        const expected = Math.floor((amountCents * 1e8) / priceCents);
        expect(estimateUnitsE8(amountCents, priceCents)).toBe(expected);
    });

    it("coincide con la fórmula entera del backend para acciones", () => {
        // 500 USD (50.000 céntimos) a 228,50 USD (22.850 céntimos)
        const amountCents = 50_000;
        const priceCents = 22_850;
        const expected = Math.floor((amountCents * 1e8) / priceCents);
        expect(estimateUnitsE8(amountCents, priceCents)).toBe(expected);
    });

    it("devuelve 0 con importes o precios inválidos o menores o iguales a cero", () => {
        expect(estimateUnitsE8(0, 10_000)).toBe(0);
        expect(estimateUnitsE8(-100, 10_000)).toBe(0);
        expect(estimateUnitsE8(1000, 0)).toBe(0);
        expect(estimateUnitsE8(1000, -50)).toBe(0);
    });

    it("devuelve 0 si el importe no alcanza para una unidad mínima", () => {
        // 1 céntimo con un activo de 200.000.000 céntimos (2M USD)
        expect(estimateUnitsE8(1, 200_000_000)).toBe(0);
    });
});

describe("estimateSellUnitsE8", () => {
    it("redondea hacia arriba (ceil) de modo que no se entreguen menos unidades", () => {
        // 100 USD (10.000 céntimos) con activo a 3 céntimos: ceil(10000 * 1e8 / 3) = 333.333.333.334
        expect(estimateSellUnitsE8(10_000, 3)).toBe(333_333_333_334);
    });

    it("devuelve 0 con importes o precios inválidos", () => {
        expect(estimateSellUnitsE8(0, 10_000)).toBe(0);
        expect(estimateSellUnitsE8(-100, 10_000)).toBe(0);
        expect(estimateSellUnitsE8(1000, 0)).toBe(0);
    });
});

describe("calculateHoldingValueCents", () => {
    it("calcula el valor exacto redondeado al más cercano con BigInt", () => {
        // 50.000.000 unidades (0.5) a 20.000 céntimos (200 USD) = 10.000 céntimos (100 USD)
        expect(calculateHoldingValueCents(50_000_000, 20_000)).toBe(10_000);
    });

    it("devuelve 0 si las unidades o precio son <= 0", () => {
        expect(calculateHoldingValueCents(0, 20_000)).toBe(0);
        expect(calculateHoldingValueCents(50_000_000, 0)).toBe(0);
    });
});

describe("formatChangePct", () => {
    it("formatea variaciones positivas con signo + y dos decimales", () => {
        expect(formatChangePct(2.5)).toBe("+2,50 %");
        expect(formatChangePct(0.05)).toBe("+0,05 %");
        expect(formatChangePct(12.345)).toBe("+12,35 %");
    });

    it("formatea variaciones negativas con signo - y dos decimales", () => {
        expect(formatChangePct(-1.2)).toBe("-1,20 %");
        expect(formatChangePct(-0.01)).toBe("-0,01 %");
    });

    it("formatea cero con signo +", () => {
        expect(formatChangePct(0)).toBe("+0,00 %");
    });

    it("devuelve raya para nulos o no finitos", () => {
        expect(formatChangePct(null)).toBe("—");
        expect(formatChangePct(Number.NaN)).toBe("—");
    });
});
