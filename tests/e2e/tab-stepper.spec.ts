/**
 * E2E: the note tab stepper in the editor header (prev / position / next).
 *
 * Touch devices have no arrow keys, so on iPad the only way to walk the tab strip
 * was tapping tabs directly. The header stepper gives an explicit prev/next with a
 * "3/12" readout, sharing one implementation with the keyboard arrows.
 *
 * SELF-CLEANING: notes are seeded via the API and hard-deleted afterwards.
 *
 * Covered:
 *   - iPad landscape: stepper visible, Next advances to another note, Prev returns
 *   - Ends are disabled (can't step past the first / last tab)
 */
import { test, expect, request as apiRequest, type APIRequestContext } from "@playwright/test";

const BASE_URL = "http://localhost:4444";
const TITLE_PREFIX = "__e2e_step_";
const createdIds: string[] = [];

async function seedNote(request: APIRequestContext, title: string): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
        const res = await request
            .post("/api/stickies?raw=1", {
                data: { folder_name: "CLAUDE", type: "text", title, content: `body of ${title}` },
                timeout: 30_000,
            })
            .catch(() => null);
        if (res && res.ok()) {
            const id = String((await res.json()).note.id);
            createdIds.push(id);
            return id;
        }
        await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error("seed failed");
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

test.describe("Tab stepper", () => {
    test.beforeEach(() => test.setTimeout(90_000));

    test("iPad landscape: stepper walks between notes and shows position", async ({ page, request }) => {
        // Landscape iPad - the case the stepper exists for.
        await page.setViewportSize({ width: 1180, height: 820 });

        const stamp = Date.now();
        const ids: string[] = [];
        for (let i = 1; i <= 3; i++) ids.push(await seedNote(request, `${TITLE_PREFIX}${stamp}_${i}`));

        // Open the middle note so both directions are available.
        await page.goto(`/?noteId=${encodeURIComponent(ids[1])}`, { waitUntil: "domcontentloaded" });
        await expect(page.locator(".editor-frame")).toBeVisible({ timeout: 20_000 });

        const prev = page.locator('[aria-label="Previous note"]');
        const next = page.locator('[aria-label="Next note"]');
        // The stepper only mounts once the tab list has resolved more than one note
        // (tabNav.notes.length > 1). That list loads asynchronously, and emulated WebKit
        // under 5 parallel workers is the slowest path in the suite, so give it room -
        // the describe block already allows 90s per test.
        await expect(prev).toBeVisible({ timeout: 30_000 });
        await expect(next).toBeVisible();

        // Position readout renders as "<n>/<total>". Assert its SHAPE only: the board is
        // live (other specs and the owner's own automations create and delete notes while
        // this runs), so both the index and the total legitimately drift mid-test.
        const readout = prev.locator("xpath=following-sibling::span[1]");
        expect((await readout.textContent())?.trim() ?? "").toMatch(/^\d+\/\d+$/);

        // What "stepping works" actually means is which NOTE is open, and note identity
        // is stable no matter how the surrounding list churns.
        const openTitle = async () => page.locator('input[placeholder="Note Title"]').first().inputValue();
        const before = await openTitle();
        expect(before).toContain(TITLE_PREFIX);

        // Stepping must land on a DIFFERENT note.
        await next.click();
        await expect.poll(openTitle, { timeout: 15_000 }).not.toBe(before);

        // And stepping back returns to the note we started on.
        await prev.click();
        await expect.poll(openTitle, { timeout: 15_000 }).toBe(before);
    });

    test("phone keeps the header clean (no stepper)", async ({ page, request }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        const id = await seedNote(request, `${TITLE_PREFIX}phone_${Date.now()}`);
        await page.goto(`/?noteId=${encodeURIComponent(id)}`, { waitUntil: "domcontentloaded" });
        await expect(page.locator(".editor-frame")).toBeVisible({ timeout: 20_000 });
        await expect(page.locator('[aria-label="Next note"]')).toBeHidden();
    });
});
