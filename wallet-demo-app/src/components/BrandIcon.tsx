import React from "react";
import { resolveBrand } from "../lib/brands";

type BrandIconProps = {
    brandKey: string;
    name?: string | null;
    size?: number;
    className?: string;
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const clean = hex.replace("#", "").trim();
    if (clean.length === 6) {
        return {
            r: parseInt(clean.slice(0, 2), 16),
            g: parseInt(clean.slice(2, 4), 16),
            b: parseInt(clean.slice(4, 6), 16),
        };
    }
    return null;
}

export const BrandIcon: React.FC<BrandIconProps> = ({
    brandKey,
    name,
    size = 40,
    className = "",
}) => {
    const brand = resolveBrand(brandKey, name);
    const rgb = hexToRgb(brand.hex);

    // Si el color de marca es casi negro (ej. Zara, Uber, Apple) usamos un tinte blanco translúcido
    const isDark = !rgb || (rgb.r < 30 && rgb.g < 30 && rgb.b < 30);
    const bg = isDark
        ? "rgba(255, 255, 255, 0.12)"
        : `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.20)`;
    const border = isDark
        ? "rgba(255, 255, 255, 0.22)"
        : `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.38)`;

    const iconSize = Math.round(size * 0.52);
    // Para textos de 3 o 4 letras (ej. MSFT, AMZN), reducimos ligeramente la tipografía
    const textLen = brand.fallbackText.length;
    const fontSize = textLen > 3 ? Math.round(size * 0.26) : textLen > 2 ? Math.round(size * 0.30) : Math.round(size * 0.36);

    return (
        <div
            aria-hidden="true"
            className={`brand-icon ${className}`.trim()}
            style={{
                width: size,
                height: size,
                minWidth: size,
                minHeight: size,
                borderRadius: "50%",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: bg,
                border: `1px solid ${border}`,
                boxSizing: "border-box",
                userSelect: "none",
                flexShrink: 0,
            }}
        >
            {brand.path ? (
                <svg
                    viewBox="0 0 24 24"
                    width={iconSize}
                    height={iconSize}
                    fill="#FFFFFF"
                    style={{ display: "block" }}
                >
                    <path d={brand.path} />
                </svg>
            ) : (
                <span
                    style={{
                        color: "#FFFFFF",
                        fontSize,
                        fontWeight: 700,
                        lineHeight: 1,
                        letterSpacing: "-0.03em",
                        textAlign: "center",
                    }}
                >
                    {brand.fallbackText}
                </span>
            )}
        </div>
    );
};
