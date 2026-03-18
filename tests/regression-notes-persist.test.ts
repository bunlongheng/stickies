/**
 * Regression E2E test: notes must remain visible after navigating back from editor
 *
 * Bug: sync() cache load replaced dbData with folder-only snapshot, wiping notes.
 *      The await saveNote() change in backToRootFromEditor made it reliably broken.
 *
 * Fix: sync() now merges cached folders with existing notes (functional updater).
 *      void sync() removed from saveNote for updates.
 *
 * Tags: regression, e2e, navigation, notes-persist
 * Priority: critical
 */
import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:4444";

async function waitForNotes(page: Page, timeout = 8000) {
    await expect(
        page.locator(".list-row-hover, [data-testid='note-tile']").first()
    ).toBeVisible({ timeout });
}

test.describe("notes persist after back navigation (regression b15ef66 / abe1aa5)", () => {
    test("notes still visible after opening and closing a note", async ({ page }) => {
        await page.goto(BASE, { waitUntil: "networkidle" });

        // Navigate into first folder
        const firstFolder = page.locator(".list-row-hover").first();
        await expect(firstFolder).toBeVisible({ timeout: 8000 });
        await firstFolder.click();

        // Wait for notes to load inside the folder
        await waitForNotes(page, 8000);
        const noteCountBefore = await page.locator(".list-row-hover").count();
        expect(noteCountBefore).toBeGreaterThan(0);

        // Open the first note
        await page.locator(".list-row-hover").first().click();
        await expect(page.locator("textarea, .rich-editor, [contenteditable]").first()).toBeVisible({ timeout: 5000 });

        // Click back
        const backBtn = page.locator("button[aria-label*='Back'], button[title*='Back']").first();
        await expect(backBtn).toBeVisible({ timeout: 3000 });
        await backBtn.click();

        // Notes must still be visible — regression check
        await expect(page.locator(".list-row-hover").first()).toBeVisible({ timeout: 5000 });
        const noteCountAfter = await page.locator(".list-row-hover").count();
        expect(noteCountAfter).toBeGreaterThan(0);
    });

    test("notes count is stable after multiple open/close cycles", async ({ page }) => {
        await page.goto(BASE, { waitUntil: "networkidle" });

        const firstFolder = page.locator(".list-row-hover").first();
        await expect(firstFolder).toBeVisible({ timeout: 8000 });
        await firstFolder.click();

        await waitForNotes(page, 8000);
        const baseCount = await page.locator(".list-row-hover").count();

        for (let i = 0; i < 2; i++) {
            await page.locator(".list-row-hover").first().click();
            await expect(
                page.locator("textarea, .rich-editor, [contenteditable]").first()
            ).toBeVisible({ timeout: 5000 });

            const backBtn = page.locator("button[aria-label*='Back'], button[title*='Back']").first();
            await backBtn.click();
            await expect(page.locator(".list-row-hover").first()).toBeVisible({ timeout: 5000 });
        }

        const finalCount = await page.locator(".list-row-hover").count();
        // Count should not drop (may increase if a new note was created)
        expect(finalCount).toBeGreaterThanOrEqual(baseCount);
    });
});
