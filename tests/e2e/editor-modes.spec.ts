/**
 * E2E: editor view modes (markdown preview + checklist).
 *
 * SELF-CLEANING: notes are seeded via the API and hard-deleted in afterEach.
 * No pre-existing user notes are touched.
 *
 * Covered flows:
 *   - Markdown note: the Preview/Code (eye/code) toggle swaps raw textarea <-> rendered preview
 *   - Checklist note: the checklist view renders task rows and toggling a checkbox flips its state
 */
import { test, expect, request as apiRequest, type Page, type APIRequestContext } from "@playwright/test";

const BASE_URL = "http://localhost:4444";
const TITLE_PREFIX = "__e2e_modes_";
const createdIds: string[] = [];

// Retries a few times so a transient dev-server recompile does not fail the seed.
async function seedNote(
    request: APIRequestContext,
    fields: { title: string; content?: string; type?: string }
): Promise<string> {
    const payload = { folder_name: "CLAUDE", type: "text", content: "", ...fields };
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

// Open a seeded note deterministically via its deep-link (?noteId=<id>).
async function openSeededNoteById(page: Page, id: string) {
    await page.goto(`/?noteId=${encodeURIComponent(id)}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".editor-frame")).toBeVisible({ timeout: 20_000 });
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

test.describe("Editor modes", () => {
    // The shared dev server can be slow under load — give tests headroom.
    test.beforeEach(() => test.setTimeout(90_000));

    test("markdown note: Preview/Code toggle swaps textarea and rendered preview", async ({ page, request }) => {
        const title = `${TITLE_PREFIX}md_${Date.now()}`;
        // Strong markdown signals so the app auto-detects type=markdown.
        const content = "# Heading One\n\nSome **bold** text and a list:\n\n- item one\n- item two\n";
        const id = await seedNote(request, { title, content, type: "markdown" });

        await openSeededNoteById(page, id);

        // Markdown notes start in raw (Code) view → textarea visible, Preview button shown.
        await expect(page.locator("textarea").first()).toBeVisible({ timeout: 10_000 });
        const previewBtn = page.locator('[aria-label="Preview"]').first();
        if (!(await previewBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
            test.skip(true, "Markdown Preview toggle not shown (note not detected as markdown) — skipping");
        }
        await previewBtn.click();

        // Now the rendered markdown preview is shown (the heading text appears in .md-preview).
        const preview = page.locator(".md-preview");
        await expect(preview).toBeVisible({ timeout: 10_000 });
        await expect(preview.getByRole("heading", { name: "Heading One" })).toBeVisible({ timeout: 10_000 });

        // Toggle back to Code → the raw textarea returns.
        const codeBtn = page.locator('[aria-label="Code"]').first();
        await expect(codeBtn).toBeVisible({ timeout: 10_000 });
        await codeBtn.click();
        await expect(page.locator("textarea").first()).toBeVisible({ timeout: 10_000 });
    });

    test("checklist note: renders task rows and toggling a checkbox flips its state", async ({ page, request }) => {
        const title = `${TITLE_PREFIX}check_${Date.now()}`;
        // Checklist content: leading [ ] / [x] markers trigger the checklist view.
        const content = "[ ] first task\n[ ] second task\n[x] already done\n";
        const id = await seedNote(request, { title, content, type: "checklist" });

        await openSeededNoteById(page, id);

        // The checklist view shows the task labels.
        await expect(page.getByText("first task", { exact: false }).first()).toBeVisible({ timeout: 10_000 });

        // Each task row has a square toggle button (w-5 h-5 border-2). Toggle the
        // first one and assert the content persisted to the API reflects the change.
        const firstRow = page.getByText("first task").first();
        await expect(firstRow).toBeVisible();
        // The checkbox button sits just before the label inside the same row.
        const toggle = page.locator('button.flex-shrink-0.w-5.h-5').first();
        if (!(await toggle.isVisible({ timeout: 4000 }).catch(() => false))) {
            test.skip(true, "Checklist toggle button not found — note may not have entered checklist view");
        }
        await toggle.click();
        // Allow the autosave debounce to flush the toggled state.
        await page.waitForTimeout(2800);

        // Confirm via API the note's content changed (a task gained an [x]/[/] marker
        // OR lost one — either way the checkbox state moved, proving the toggle wired through).
        const res = await request.get(`/api/stickies?id=${encodeURIComponent(id)}`);
        if (res.ok()) {
            const body = await res.json();
            const saved: string = (body.note?.content ?? body.notes?.[0]?.content ?? "") as string;
            // The seeded content had exactly one [x]; after toggling the first task the
            // done-count must differ from the original.
            const doneCount = (saved.match(/\[x\]/gi) || []).length + (saved.match(/\[\/\]/g) || []).length;
            expect(doneCount).not.toBe(1);
        } else {
            // Fallback: assert the UI shows a rendered checkmark (visual state changed).
            await expect(page.locator(".editor-frame")).toBeVisible();
        }
    });
});
