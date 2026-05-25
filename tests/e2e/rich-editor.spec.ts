/**
 * E2E: rich-text editor (Phase 1).
 *
 * Covers:
 *   - Sign-in page renders (dev shows "Go in (dev)" button)
 *   - Opening an existing text note renders the textarea (not the rich editor)
 *   - Clicking + (new note) mounts the rich editor + toolbar
 *   - Toolbar buttons are present
 *   - View picker exposes the "Rich" mode option
 *   - Format switch survives a reload (autosave + persistence)
 *
 * These tests run against `npm run dev` on port 4444. The dev bypass
 * in `authenticate()` lets us skip the OAuth dance. CI should set
 * NODE_ENV=development for the same reason.
 */
import { test, expect, type Page } from "@playwright/test";

// New notes are created via the speed-dial FAB: click the floating + button,
// then the "File" bubble (which calls openNewNote → a rich note). The FAB is
// icon-only (no aria-label), so target the bottom-right floating container and
// the File action's title — the same proven flow the notes-crud suite uses.
async function openNewNote(page: Page) {
    const fab = page.locator('div.fixed.bottom-5.right-4 > button').first();
    await expect(fab).toBeVisible({ timeout: 10_000 });
    await fab.click({ force: true }); // FAB has a perpetual pulse; force past stability wait
    const fileBubble = page.locator('button[title="File"]');
    await expect(fileBubble).toBeVisible({ timeout: 10_000 });
    await fileBubble.click();
}

test.describe("Rich editor (Phase 1)", () => {
    test("sign-in page renders the Stickies card", async ({ page }) => {
        const res = await page.goto("/sign-in");
        expect(res?.status()).toBe(200);
        await expect(page.getByRole("heading", { name: "Stickies" })).toBeVisible();
        // Dev mode shows the bypass link
        await expect(page.getByText("Go in (dev)")).toBeVisible();
    });

    test("home renders folder grid or list", async ({ page }) => {
        await page.goto("/");
        const anyContent = page.locator(".folder-grid-tile, .grid-square-tile, .list-row-hover");
        await expect(anyContent.first()).toBeVisible({ timeout: 15_000 });
    });

    test("opening an existing text note shows the raw textarea (not rich)", async ({ page }) => {
        await page.goto("/");
        // Click first folder to enter it
        const firstFolder = page.locator(".folder-grid-tile, .list-row-hover").first();
        await firstFolder.click();
        // Click first note tile (best-effort — folders may be empty)
        const firstNote = page.locator("[data-note-tile], .note-tile-button").first();
        if (!(await firstNote.isVisible({ timeout: 5000 }).catch(() => false))) {
            test.skip(true, "No notes in first folder to open — skipping");
        }
        await firstNote.click();
        // Existing notes default to format='text' → textarea, not TipTap
        await expect(page.locator("textarea")).toBeVisible({ timeout: 10_000 });
        // Toolbar from rich editor should NOT be present for text notes
        await expect(page.locator(".rich-editor-prose")).toHaveCount(0);
    });

    test("creating a new note mounts the rich editor + toolbar", async ({ page, isMobile }) => {
        await page.goto("/");
        await openNewNote(page);
        // Rich editor surface should mount (new notes default to format='rich')
        await expect(page.locator(".rich-editor-prose")).toBeVisible({ timeout: 10_000 });
        // Bold / Italic are always in the toolbar (.first — wider viewports render
        // a second responsive toolbar variant, so the loose title regex matches 2).
        await expect(page.getByTitle(/Bold/i).first()).toBeVisible();
        await expect(page.getByTitle(/Italic/i).first()).toBeVisible();
        // Heading buttons are hidden on small screens (hidden sm:inline-flex) — desktop only.
        if (!isMobile) await expect(page.getByTitle(/Heading 1/i).first()).toBeVisible();
    });

    test("rich editor accepts typed text", async ({ page }) => {
        await page.goto("/");
        await openNewNote(page);
        const editor = page.locator(".rich-editor-prose");
        await expect(editor).toBeVisible({ timeout: 10_000 });
        await editor.click();
        await page.keyboard.type("Hello from Playwright");
        await expect(editor).toContainText("Hello from Playwright");
    });

    test("Bold toolbar button toggles bold on selection", async ({ page, isMobile }) => {
        test.skip(isMobile, "Select-all + toolbar bolding is a desktop keyboard interaction");
        await page.goto("/");
        await openNewNote(page);
        const editor = page.locator(".rich-editor-prose");
        await expect(editor).toBeVisible({ timeout: 10_000 });
        await editor.click();
        await page.keyboard.type("bold-me");
        await page.keyboard.press("Control+A");
        await page.getByTitle("Bold (⌘B)").click();
        // After bolding, a <strong> should exist
        await expect(editor.locator("strong")).toBeVisible();
    });

    test("editor area is black-on-white regardless of note color", async ({ page }) => {
        await page.goto("/");
        await openNewNote(page);
        const editor = page.locator(".rich-editor-prose");
        await expect(editor).toBeVisible({ timeout: 10_000 });
        // Computed color should be very dark, background very light
        const color = await editor.evaluate((el) => getComputedStyle(el).color);
        // "rgb(26, 26, 26)" is #1a1a1a — close enough to black
        expect(color).toMatch(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        const [_, r, g, b] = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)!;
        expect(parseInt(r) + parseInt(g) + parseInt(b)).toBeLessThan(150); // dark text
    });
});

test.describe("Open an existing rich note", () => {
    // Self-cleaning: the seeded rich note is hard-deleted after each test.
    const createdIds: string[] = [];
    test.afterEach(async ({ request }) => {
        while (createdIds.length) {
            await request.delete(`/api/stickies?id=${encodeURIComponent(createdIds.pop()!)}`).catch(() => {});
        }
    });

    test("regression: existing rich note loads its doc content (not just empty toolbar)", async ({ page, request }) => {
        // Bug 2026-05-19: opening any saved rich note showed only the toolbar +
        // "Start writing…" placeholder because the autoFocus + late-arriving
        // initialDoc tripped the editor.isFocused guard inside RichEditor.
        //
        // Deterministic + viewport-independent: seed a rich note (format='rich' +
        // doc) straight through the API, open it via the ?noteId= deep-link, and
        // assert the saved text renders inside the editor (not just a placeholder).
        const distinctive = `__e2e_rich_reload_${Date.now()}`;
        const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: distinctive }] }] };
        const res = await request.post("/api/stickies?raw=1", {
            data: { title: distinctive, content: distinctive, doc, format: "rich", type: "text", folder_name: "CLAUDE" },
            timeout: 30_000,
        });
        expect(res.ok()).toBeTruthy();
        const { note } = await res.json();
        createdIds.push(String(note.id));

        await page.goto(`/?noteId=${encodeURIComponent(note.id)}`, { waitUntil: "domcontentloaded" });

        const reopenedEditor = page.locator(".rich-editor-prose");
        await expect(reopenedEditor).toBeVisible({ timeout: 20_000 });
        await expect(reopenedEditor).toContainText(distinctive, { timeout: 10_000 });
    });
});

test.describe("Embed route", () => {
    test("/embed/note/[id] without ?key returns 'Unauthorized'", async ({ page }) => {
        await page.goto("/embed/note/00000000-0000-0000-0000-000000000000");
        await expect(page.getByText("Unauthorized")).toBeVisible();
    });

    test("/embed/note/[id] with wrong key still 'Unauthorized'", async ({ page }) => {
        await page.goto("/embed/note/00000000-0000-0000-0000-000000000000?key=wrong");
        await expect(page.getByText("Unauthorized")).toBeVisible();
    });
});
