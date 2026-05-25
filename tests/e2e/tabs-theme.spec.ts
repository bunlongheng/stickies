/**
 * E2E: tab mode + theme/appearance toggle.
 *
 * SELF-CLEANING: the tab-mode test seeds one note (so a tab exists) and deletes
 * it in afterEach. The theme test is fully read-only.
 *
 * Covered flows:
 *   - Tab mode (?view=tabs) renders a tab strip with a New-note (+) tab
 *   - Theme/appearance segmented control (Auto / Light / Dark) switches data-theme
 */
import { test, expect, request as apiRequest, type Page, type APIRequestContext } from "@playwright/test";

const BASE_URL = "http://localhost:4444";
const TITLE_PREFIX = "__e2e_tabs_";
const createdIds: string[] = [];

// Retries a few times so a transient dev-server recompile does not fail the seed.
async function seedNote(request: APIRequestContext, title: string): Promise<string> {
    const payload = { folder_name: "CLAUDE", type: "text", content: "tab content", title };
    let lastStatus = 0;
    for (let attempt = 0; attempt < 5; attempt++) {
        const res = await request
            .post("/api/stickies?raw=1", { data: payload, timeout: 30_000 })
            .catch(() => null);
        if (res && res.ok()) {
            const body = await res.json();
            const id = String(body.note.id);
            createdIds.push(id);
            return id;
        }
        lastStatus = res ? res.status() : 0;
        await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error(`seed failed after retries (last status ${lastStatus})`);
}

test.afterEach(async ({ request }) => {
    while (createdIds.length) {
        const id = createdIds.pop()!;
        await request.delete(`/api/stickies?id=${encodeURIComponent(id)}`).catch(() => {});
    }
});

// Bulletproof sweep — hard-delete every note carrying this file's __e2e_ prefix,
// covering orphans from a crashed worker. Never touches pre-existing notes.
test.afterAll(async () => {
    const ctx = await apiRequest.newContext({ baseURL: BASE_URL });
    const res = await ctx.get(`/api/stickies?folder=CLAUDE`).catch(() => null);
    if (res && res.ok()) {
        const { notes } = await res.json();
        for (const n of notes as Array<{ id: string; title?: string }>) {
            if (typeof n.title === "string" && n.title.startsWith(TITLE_PREFIX)) {
                await ctx.delete(`/api/stickies?id=${encodeURIComponent(String(n.id))}`).catch(() => {});
            }
        }
    }
    await ctx.dispose();
});

// The shared dev server can be slow under load — give tests headroom.
test.beforeEach(() => test.setTimeout(90_000));

test.describe("Tab mode", () => {
    test("?view=tabs renders a tab strip with a New-note (+) tab", async ({ page, request }) => {
        // Seed a fresh note so Today's tab list is non-empty.
        await seedNote(request, `${TITLE_PREFIX}${Date.now()}`);

        await page.goto("/?view=tabs", { waitUntil: "domcontentloaded" });
        // The app may need a moment to read the URL param and switch modes.
        const newTabBtn = page.locator('button[title="New note"]');
        await expect(newTabBtn.first()).toBeVisible({ timeout: 20_000 });

        // In tabs mode the editor surface is mounted (a tab auto-opens the latest note),
        // so the editor frame should be present.
        await expect(page.locator(".editor-frame")).toBeVisible({ timeout: 15_000 });
    });
});

async function openGlobalSettings(page: Page) {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const anyTile = page.locator(".folder-grid-tile, .grid-square-tile, .list-row-hover");
    await expect(anyTile.first()).toBeVisible({ timeout: 20_000 });
    // The Settings gear lives in the root header (label "Settings").
    const gear = page.locator('header [aria-label="Settings"]').first();
    await expect(gear).toBeVisible({ timeout: 10_000 });
    await gear.click();
    // The settings panel shows a "Theme" section.
    await expect(page.getByText("Theme", { exact: true })).toBeVisible({ timeout: 10_000 });
}

test.describe("Theme / appearance", () => {
    test("Light/Dark segmented control switches data-theme", async ({ page }) => {
        await openGlobalSettings(page);

        const lightBtn = page.getByRole("button", { name: "Light", exact: true });
        const darkBtn = page.getByRole("button", { name: "Dark", exact: true });
        await expect(lightBtn).toBeVisible({ timeout: 10_000 });
        await expect(darkBtn).toBeVisible({ timeout: 10_000 });

        // Force Light → <html data-theme="light">
        await lightBtn.click();
        await expect(page.locator("html")).toHaveAttribute("data-theme", "light", { timeout: 10_000 });

        // Force Dark → <html data-theme="dark">
        await darkBtn.click();
        await expect(page.locator("html")).toHaveAttribute("data-theme", "dark", { timeout: 10_000 });

        // Reset to Auto so we leave no persisted preference behind.
        const autoBtn = page.getByRole("button", { name: "Auto", exact: true });
        await autoBtn.click();
    });
});
