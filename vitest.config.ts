import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        setupFiles: ["./tests/setup.ts"],
        include: ["lib/**/*.test.ts", "tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
        coverage: {
            provider: "v8",
            // Thresholds reflect the state on 2026-05-19 after the auth migration
            // and the test push. They're floors — anyone dropping below this on a
            // PR will see CI fail. Push them up; don't lower them.
            thresholds: { lines: 83, functions: 73, branches: 67, statements: 79 },
            include: ["lib/**/*.ts", "app/api/**/*.ts"],
            exclude: [
                "lib/db.ts",
                "lib/db-driver.ts",
                "lib/usePageMeta.ts",       // client-only React hook — not testable in node
                "app/api/auth/**",           // NextAuth handlers — tested via e2e
                "app/api/hue/**",            // hardware integration — tested manually
                "app/api/stickies/ext/**",   // re-exports from main route — already covered
                "app/api/stickies/integrations/diagrams/**",  // external data source
                "app/api/stickies/integrations/mindmaps/**",  // external data source
            ],
        },
    },
    resolve: {
        alias: { "@": path.resolve(__dirname, ".") },
    },
});
