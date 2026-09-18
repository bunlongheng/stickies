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
import { gotoFolderGrid, firstFolderTile } from "./nav-helpers";

// Wait until the home grid/list has hydrated and shows at least one tile.
async function waitForHome(page: Page) {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const anyTile = page.locator("[data-note-id]");
    await expect(anyTile.first()).toBeVisible({ timeout: 20_000 });
}

test.describe("Navigation", () => {
    // The shared dev server can be slow under load — give tests headroom.
    test.beforeEach(() => test.setTimeout(90_000));

    test("home renders the folder grid or list", async ({ page }) => {
        await waitForHome(page);
        const tiles = page.locator("[data-note-id]");
        expect(await tiles.count()).toBeGreaterThan(0);
    });

    test("opening a folder shows its header (back arrow + breadcrumb)", async ({ page }) => {
        // The app lands in "All" (notes, no folder tiles) - step out to the real grid.
        await gotoFolderGrid(page);
        await firstFolderTile(page).click();

        // Inside a folder the back arrow appears; the FAB + button stays available.
        const backArrow = page.locator('header button:has(svg)').first();
        await expect(backArrow).toBeVisible({ timeout: 10_000 });
    });

    test("back navigation returns to the folder grid", async ({ page }) => {
        await gotoFolderGrid(page);
        await firstFolderTile(page).click();

        // The breadcrumb / back arrow region must be present before we go back.
        const backArrow = page.locator('header button:has(svg)').first();
        await expect(backArrow).toBeVisible({ timeout: 10_000 });
        await backArrow.click();

        // Back returns to the folder grid — assert a home tile reappears. This is a
        // more robust "we're home" signal than the SEARCH label, which is slow to
        // paint on mobile webkit under load.
        const homeTiles = page.locator("[data-note-id]");
        await expect(homeTiles.first()).toBeVisible({ timeout: 15_000 });
    });

    test("view-mode toggle cycles the main list layout", async ({ page }) => {
        await waitForHome(page);
        // There are exactly two main list modes now - list and tabs (the thumbnail
        // grid was dropped in #67, so "Thumb"/"Graph" no longer exist). The toggle is
        // labelled by the mode it is currently showing.
        const viewBtn = page.locator('header [aria-label="List"], header [aria-label="Tabs"]').first();
        await expect(viewBtn).toBeVisible({ timeout: 10_000 });
        expect(await viewBtn.getAttribute("aria-label")).toBe("List");

        await viewBtn.click();

        // Tabs mode hides the whole list header (the tab strip becomes the navigation),
        // so asserting the toggle is still on screen would contradict the design. The
        // observable outcome is the mode switch itself: the URL flips and the tab strip
        // with its New-note tab takes over. View mode lives in client storage, and each
        // test runs in a fresh context, so there is nothing to restore for the next spec.
        await expect(page).toHaveURL(/mode=tabs/, { timeout: 10_000 });
        await expect(page.locator('button[title="New note"]').first()).toBeVisible({ timeout: 20_000 });
    });
});
