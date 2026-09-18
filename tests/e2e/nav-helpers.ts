/**
 * Shared e2e navigation helpers.
 *
 * The app deliberately ALWAYS lands in the virtual "All" view (page.tsx
 * "Always-ALL landing"), which lists notes - not folders - and whose header
 * exposes folder-scoped Settings rather than global Settings. Specs that need
 * the real root folder grid (folder tiles, global Settings) must therefore step
 * out of "All" first instead of assuming "/" is the grid.
 */
import { expect, type Page } from "@playwright/test";

// Every row (folder or note) carries data-note-id. A folder row is labelled
// "Folder <name>" for screen readers, which is what identifies it now that the
// thumbnail grid and its .folder-grid-tile class are gone.
const ANY_TILE = "[data-note-id]";
// A folder row is labelled "Folder <name>". "All" is a virtual card, not a real
// folder: entering it lands back where we started, so specs skip it.
const REAL_FOLDER_TILE = '[data-note-id][aria-label^="Folder "]:not([aria-label="Folder All"]):not([aria-label="Folder Today"])';

/** Land the app and settle on the first painted tile (any view). */
export async function gotoApp(page: Page) {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator(ANY_TILE).first()).toBeVisible({ timeout: 20_000 });
}

/**
 * Reach the ROOT folder grid, where folder tiles and global Settings live.
 * Lands first, then steps back out of the default "All" view if needed.
 */
export async function gotoFolderGrid(page: Page) {
    await gotoApp(page);
    // Wait for a REAL folder, not merely any folder tile: the root grid paints the
    // virtual "All" card first and fills in real folders as the folder list resolves,
    // so settling on "a folder tile exists" hands callers a grid they cannot click yet.
    const real = page.locator(REAL_FOLDER_TILE);
    // Two attempts: the first tile can paint before React has hydrated the header, and
    // a click landing in that window is swallowed, leaving us still inside "All".
    for (let attempt = 0; attempt < 2; attempt++) {
        if (await real.first().isVisible({ timeout: 2_000 }).catch(() => false)) break;
        // In "All" (or any folder): the header back arrow is the first icon button.
        await page.locator("header button:has(svg)").first().click().catch(() => {});
        if (await real.first().isVisible({ timeout: 10_000 }).catch(() => false)) break;
    }
    await expect(real.first()).toBeVisible({ timeout: 10_000 });
    await settleGrid(page);
}

/**
 * Wait for the grid to stop changing before interacting with it. The suite shares
 * one dev server and database, so a sibling spec seeding or deleting notes can
 * re-render the grid and detach the tile mid-click. Polling until the tile count
 * holds steady removes that whole class of cross-test flake.
 */
async function settleGrid(page: Page) {
    const tiles = page.locator(ANY_TILE);
    let last = -1;
    for (let i = 0; i < 12; i++) {
        const n = await tiles.count().catch(() => -1);
        if (n > 0 && n === last) return;
        last = n;
        await page.waitForTimeout(250);
    }
}

/** First REAL folder tile on the root grid (never the virtual "All" card), ready to click. */
export function firstFolderTile(page: Page) {
    return page.locator(REAL_FOLDER_TILE).first();
}
