import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import unusedImports from "eslint-plugin-unused-imports";

// Flat ESLint config. The Next + typescript-eslint rulesets are on, but the noisy
// rules that fire across the (still large) codebase are set to 'warn' so the lint
// gate is useful and exits clean today; they get ratcheted to 'error' as the debt
// is paid down. Build output, generated files, and scratch scripts are ignored.
export default [
    {
        ignores: [
            ".next/**",
            "node_modules/**",
            "dist/**",
            "build/**",
            "coverage/**",
            "playwright-report/**",
            "test-results/**",
            "next-env.d.ts",
            "scripts/**",
            "db/**",
            "*.config.mjs",
            "*.config.ts",
        ],
    },
    ...nextCoreWebVitals,
    ...nextTypescript,
    {
        plugins: { "unused-imports": unusedImports },
        rules: {
            // Auto-removable: strips dead imports on `eslint --fix`.
            "unused-imports/no-unused-imports": "warn",
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
            "@typescript-eslint/no-empty-object-type": "warn",
            "@typescript-eslint/no-require-imports": "warn",
            "react-hooks/exhaustive-deps": "warn",
            "react/no-unescaped-entities": "warn",
            "@next/next/no-img-element": "warn",
            "@next/next/no-html-link-for-pages": "warn",
            "prefer-const": "warn",
            "no-empty": ["warn", { allowEmptyCatch: true }],
            // React 19 compiler advisories - real signals, but downgraded to warn while
            // the God component is being decomposed; ratchet to 'error' as it shrinks.
            "react-hooks/refs": "warn",
            "react-hooks/set-state-in-effect": "warn",
            "react-hooks/immutability": "warn",
            "react-hooks/preserve-manual-memoization": "warn",
            "react-hooks/purity": "warn",
        },
    },
];
