/**
 * E2E: the editor header must NOT expose the grid view-mode switcher.
 *
 * The list/tabs switcher cycles the layout of the note GRID. That grid is
 * hidden at every breakpoint while the editor is open, so inside an open note the
 * control had no visible referent and silently changed the layout you return to
 * (cycling into "tabs" especially). It belongs at root/folder level only.
 *
 * SELF-CLEANING: notes are seeded via the API and hard-deleted in afterEach.
 *
 * Covered:
 *   - Open note: no Thumb/List/Tabs button in the header; Search + Settings remain
 *   - Root view: the switcher IS present (we only removed it from the editor)
 */
import { test, expect, request as apiRequest, type Page, type APIRequestContext } from "@playwright/test";

const BASE_URL = "http://localhost:4444";
const TITLE_PREFIX = "__e2e_hdr_";
const createdIds: string[] = [];

const VIEW_MODE_LABELS = ["List", "Tabs"];

async function seedNote(request: APIRequestContext, fields: { title: string; content?: string }): Promise<string> {
    const payload = { folder_name: "CLAUDE", type: "text", content: "", ...fields };
    let lastStatus = 0;
    for (let attempt = 0; attempt < 5; attempt++) {
        const res = await request.post("/api/stickies?raw=1", { data: payload, timeout: 30_000 }).catch(() => null);
        if (res && res.ok()) {
            const id = String((await res.json()).note.id);
            createdIds.push(id);
            return id;
        }
        lastStatus = res ? res.status() : 0;
        await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error(`seed failed after retries (last status ${lastStatus})`);
}

async function openNoteById(page: Page, id: string) {
    await page.goto(`/?noteId=${encodeURIComponent(id)}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".editor-frame")).toBeVisible({ timeout: 20_000 });
}

test.afterEach(async ({ request }) => {
    while (createdIds.length) {
        const id = createdIds.pop()!;
        await request.delete(`/api/stickies?id=${encodeURIComponent(id)}`).catch(() => {});
    }
});

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

test.describe("Editor header", () => {
    test.beforeEach(() => test.setTimeout(90_000));

    test("open note shows no grid view-mode switcher, but keeps Search + Settings", async ({ page, request }) => {
        const id = await seedNote(request, { title: `${TITLE_PREFIX}${Date.now()}`, content: "body text" });
        await openNoteById(page, id);

        // The grid switcher must not be VISIBLE while the note is open. It can still
        // exist in the DOM: the root grid panel keeps its own switcher and is merely
        // class-hidden behind the editor, so visibility - not DOM presence - is the
        // correct assertion here.
        for (const label of VIEW_MODE_LABELS) {
            const btns = page.locator(`[aria-label="${label}"]`);
            for (let i = 0; i < (await btns.count()); i++) {
                await expect(btns.nth(i)).toBeHidden();
            }
        }

        // The controls that DO belong to a note stay reachable.
        await expect(page.locator('[aria-label="Search"]').first()).toBeVisible();
        await expect(page.locator('[aria-label="Settings"]').first()).toBeVisible();
    });

    test("root view still offers the view-mode switcher", async ({ page }) => {
        await page.goto("/", { waitUntil: "domcontentloaded" });
        // Root renders one of the two states (list by default).
        const anySwitcher = page.locator(
            VIEW_MODE_LABELS.map((l) => `[aria-label="${l}"]`).join(", ")
        );
        await expect(anySwitcher.first()).toBeVisible({ timeout: 20_000 });
    });
});
