import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "./tests",
    timeout: 30_000,
    retries: 1,
    use: {
        baseURL: "http://localhost:4444",
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
        command: "npm run dev -- -p 4444",
        url: "http://localhost:4444",
        reuseExistingServer: true,
        timeout: 60_000,
    },
});
