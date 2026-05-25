import { test, expect } from "@playwright/test";

test.describe("Stickies Smoke Tests", () => {
    test("homepage loads with 200", async ({ page }) => {
        const response = await page.goto("/");
        expect(response).not.toBeNull();
        expect(response!.status()).toBe(200);
    });

    test("main app UI is visible (folders, notes area)", async ({ page }) => {
        await page.goto("/");
        // Wait for the app to hydrate — folder grid tiles or list rows should appear
        const folderOrNote = page.locator(".folder-grid-tile, .list-row-hover, .grid-square-tile");
        await expect(folderOrNote.first()).toBeVisible({ timeout: 15_000 });
    });

    test("no critical console errors", async ({ page }) => {
        const errors: string[] = [];
        page.on("console", (msg) => {
            if (msg.type() !== "error") return;
            const text = msg.text();
            // Ignore React dev warnings and common non-critical noise
            if (text.includes("React") && text.includes("Warning")) return;
            if (text.includes("Download the React DevTools")) return;
            if (text.includes("ERR_CONNECTION_REFUSED")) return;
            if (text.includes("Failed to load resource")) return;
            if (text.includes("net::")) return;
            errors.push(text);
        });
        await page.goto("/");
        // Give the app time to hydrate and run side effects
        await page.waitForTimeout(3000);
        expect(errors).toEqual([]);
    });

    test("bottom status bar is visible", async ({ page }) => {
        await page.goto("/");
        // The desktop stats bottom bar is a fixed element with time display
        // On mobile it's also fixed but with sm:hidden / sm:flex breakpoints
        // Use a broad locator: the bar contains time text
        const statusBar = page.locator("div.fixed.bottom-4").first();
        await expect(statusBar).toBeAttached({ timeout: 15_000 });
    });

    test("can navigate within the app — open a folder", async ({ page }) => {
        await page.goto("/");
        // Wait for folder tiles to appear
        const folderTile = page.locator(".folder-grid-tile, .list-row-hover").first();
        await expect(folderTile).toBeVisible({ timeout: 15_000 });

        // Click the first folder
        await folderTile.click();

        // Inside a folder the header back arrow appears. It is an icon-only button
        // with no aria-label, so match the header svg button (same selector the
        // navigation suite uses) rather than the obsolete [aria-label="New note"].
        const backArrow = page.locator('header button:has(svg)').first();
        await expect(backArrow).toBeVisible({ timeout: 10_000 });
    });
});
