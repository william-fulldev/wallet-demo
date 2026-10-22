import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        setupFiles: ["./src/test/setup.ts"],
        include: ["src/**/*.test.ts"],
        // Todos los archivos comparten una base de datos: no pueden correr a la vez.
        fileParallelism: false,
        // Atlas y bcrypt son lentos comparados con una prueba pura.
        testTimeout: 30_000,
        hookTimeout: 30_000,
    },
});