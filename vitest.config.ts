import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        include: ["lib/**/*.test.ts", "tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
        coverage: {
            provider: "v8",
            thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
            include: ["lib/**/*.ts", "app/api/**/*.ts"],
            exclude: ["lib/db.ts", "lib/db-supabase.ts", "lib/db-driver.ts"],
        },
    },
    resolve: {
        alias: { "@": path.resolve(__dirname, ".") },
    },
});
