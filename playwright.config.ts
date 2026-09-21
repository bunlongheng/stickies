import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "./tests/e2e",
    testMatch: /\.spec\.ts$/,
    timeout: 30_000,
    // 2 retries: the dev box is shared (many concurrent dev servers), so mobile
    // webkit emulation occasionally times out on a cold paint. Retries absorb
    // that transient load without masking real failures (traces on retry).
    retries: 2,
    use: {
        // CI (and any parallel local run) points this elsewhere; the default keeps the
        // usual "reuse whatever is already serving 4444" behaviour.
        baseURL: process.env.E2E_BASE_URL || "http://localhost:4444",
        trace: "on-first-retry",
    },
    projects: [
        // Desktop
        { name: "Desktop Chrome", use: { ...devices["Desktop Chrome"] } },
        // iPad
        { name: "iPad",           use: { ...devices["iPad (gen 7)"] } },
        // iPhone
        { name: "iPhone 14",      use: { ...devices["iPhone 14"] } },
    ],
    webServer: {
        command: process.env.E2E_WEB_SERVER || "npm run dev -- -p 4444",
        url: process.env.E2E_BASE_URL || "http://localhost:4444",
        reuseExistingServer: true,
        timeout: 60_000,
    },
});
