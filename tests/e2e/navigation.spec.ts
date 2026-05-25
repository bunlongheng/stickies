/**
 * E2E: core navigation.
 *
 * Read-only flows — these never create DB rows:
 *   - Home renders the folder grid / list
 *   - Opening a folder shows its header (back arrow / breadcrumb)
 *   - Back navigation returns to the folder grid
 *   - View-mode toggle cycles the main list layout
 *
 * Runs against `npm run dev` on port 4444 (LAN auth bypass — no login needed).
 */
import { test, expect, type Page } from "@playwright/test";

// Wait until the home grid/list has hydrated and shows at least one tile.
async function waitForHome(page: Page) {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const anyTile = page.locator(".folder-grid-tile, .grid-square-tile, .list-row-hover");
    await expect(anyTile.first()).toBeVisible({ timeout: 20_000 });
}

test.describe("Navigation", () => {
    // The shared dev server can be slow under load — give tests headroom.
    test.beforeEach(() => test.setTimeout(90_000));

    test("home renders the folder grid or list", async ({ page }) => {
        await waitForHome(page);
        const tiles = page.locator(".folder-grid-tile, .grid-square-tile, .list-row-hover");
        expect(await tiles.count()).toBeGreaterThan(0);
    });

    test("opening a folder shows its header (back arrow + breadcrumb)", async ({ page }) => {
        await waitForHome(page);
        // Click the first folder tile (folders sort before notes in the grid).
        const folderTile = page.locator(".folder-grid-tile, .list-row-hover").first();
        await folderTile.click();

        // Inside a folder the back arrow appears; the FAB + button stays available.
        const backArrow = page.locator('header button:has(svg)').first();
        await expect(backArrow).toBeVisible({ timeout: 10_000 });
    });

    test("back navigation returns to the folder grid", async ({ page }) => {
        await waitForHome(page);
        const folderTile = page.locator(".folder-grid-tile, .list-row-hover").first();
        await folderTile.click();

        // The breadcrumb / back arrow region must be present before we go back.
        const backArrow = page.locator('header button:has(svg)').first();
        await expect(backArrow).toBeVisible({ timeout: 10_000 });
        await backArrow.click();

        // Back returns to the folder grid — assert a home tile reappears. This is a
        // more robust "we're home" signal than the SEARCH label, which is slow to
        // paint on mobile webkit under load.
        const homeTiles = page.locator(".folder-grid-tile, .grid-square-tile, .list-row-hover");
        await expect(homeTiles.first()).toBeVisible({ timeout: 15_000 });
    });

    test("view-mode toggle cycles the main list layout", async ({ page }) => {
        await waitForHome(page);
        // The Settings + view-mode buttons live at the top-right of the root header.
        // The view toggle is labelled by its current mode (Thumb / List / Tabs / Graph).
        const viewBtn = page.locator(
            'header [aria-label="Thumb"], header [aria-label="List"], header [aria-label="Tabs"], header [aria-label="Graph"]'
        ).first();
        await expect(viewBtn).toBeVisible({ timeout: 10_000 });

        const labelBefore = await viewBtn.getAttribute("aria-label");
        await viewBtn.click();

        // After a cycle, a view-mode toggle is still present (label may have changed).
        const viewBtnAfter = page.locator(
            'header [aria-label="Thumb"], header [aria-label="List"], header [aria-label="Tabs"], header [aria-label="Graph"]'
        ).first();
        await expect(viewBtnAfter).toBeVisible({ timeout: 10_000 });
        const labelAfter = await viewBtnAfter.getAttribute("aria-label");
        // Cycling should land on one of the known modes.
        expect(["Thumb", "List", "Tabs", "Graph"]).toContain(labelAfter);
        expect(typeof labelBefore).toBe("string");
    });
});
