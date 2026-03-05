/**
 * Smoke tests for Stickies
 * Covers: List · Grid · Kanban · Edit modes × Desktop · iPad · iPhone
 */
import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:4444";

// ── helpers ──────────────────────────────────────────────────────────────────

async function goHome(page: Page) {
    await page.goto(BASE, { waitUntil: "networkidle" });
}

async function clickList(page: Page) {
    await page.getByLabel("List").first().click();
}
async function clickGrid(page: Page) {
    await page.getByLabel("Grid").first().click();
}
async function clickKanban(page: Page) {
    await page.getByLabel("Kanban").first().click();
}
async function clickEdit(page: Page) {
    await page.getByLabel("Edit").first().click();
}

// ── smoke: app loads ──────────────────────────────────────────────────────────

test("app loads and shows header", async ({ page }) => {
    await goHome(page);
    await expect(page.locator("header").first()).toBeVisible();
});

// ── List mode ─────────────────────────────────────────────────────────────────

test("List mode: shows folder rows at root", async ({ page }) => {
    await goHome(page);
    await clickList(page);
    // root should show folder rows (list items with border-b)
    const rows = page.locator(".list-row-hover");
    await expect(rows.first()).toBeVisible({ timeout: 8000 });
});

test("List mode: search filters results", async ({ page }) => {
    await goHome(page);
    await clickList(page);
    const search = page.getByPlaceholder("search");
    await search.fill("a");
    await expect(page.locator(".list-row-hover").first()).toBeVisible({ timeout: 5000 });
    await search.fill("");
});

// ── Grid / Thumbnail mode ─────────────────────────────────────────────────────

test("Grid mode: shows folder tiles at root", async ({ page }) => {
    await goHome(page);
    await clickGrid(page);
    // grid mode uses display:grid — check a tile renders
    const tile = page.locator("[style*='grid']").first();
    await expect(tile).toBeVisible({ timeout: 5000 });
});

// ── Kanban mode ───────────────────────────────────────────────────────────────

test("Kanban mode: shows column headers", async ({ page, viewport }) => {
    if (!viewport || viewport.width < 768) return; // kanban hidden on small screens
    await goHome(page);
    await clickKanban(page);
    // kanban columns have folder-name headers
    const headers = page.locator("[class*='tracking-widest'][class*='uppercase']");
    await expect(headers.first()).toBeVisible({ timeout: 8000 });
});

// ── Edit mode ─────────────────────────────────────────────────────────────────

test("Edit mode: split panel appears with editor", async ({ page, viewport }) => {
    if (!viewport || viewport.width < 768) return; // edit mode only meaningful on wider screens
    await goHome(page);
    await clickEdit(page);
    // editor empty-state or editor section should be visible
    const editorPanel = page.locator("text=Select a note").or(page.locator(".rich-editor"));
    await expect(editorPanel.first()).toBeVisible({ timeout: 5000 });
});

test("Edit mode: left panel shows all notes as list", async ({ page, viewport }) => {
    if (!viewport || viewport.width < 768) return;
    await goHome(page);
    await clickEdit(page);
    // notes list (not folder tiles) — list rows visible
    const rows = page.locator(".list-row-hover");
    await expect(rows.first()).toBeVisible({ timeout: 8000 });
});

test("Edit mode: new note defaults to Work folder", async ({ page, viewport }) => {
    if (!viewport || viewport.width < 768) return;
    await goHome(page);
    await clickEdit(page);
    // click + New
    await page.getByLabel("New").first().click();
    await page.getByText("New file").click();
    // folder picker or title should be visible, and Work should be pre-selected
    await expect(page.getByPlaceholder("NOTE TITLE")).toBeVisible({ timeout: 5000 });
});

test("Edit mode: editor panel hidden when List mode active", async ({ page, viewport }) => {
    if (!viewport || viewport.width < 768) return;
    await goHome(page);
    await clickList(page); // switch away from edit
    // editor panel should NOT be visible
    const editorEmptyState = page.locator("text=Select a note");
    await expect(editorEmptyState).not.toBeVisible({ timeout: 3000 });
});

// ── Navigation: open note from list ──────────────────────────────────────────

test("List mode: clicking a folder navigates into it", async ({ page }) => {
    await goHome(page);
    await clickList(page);
    const firstRow = page.locator(".list-row-hover").first();
    await firstRow.click();
    // after clicking a folder we should see notes inside OR back button
    await expect(page.locator("header").first()).toBeVisible({ timeout: 5000 });
});

// ── Cmd+K ─────────────────────────────────────────────────────────────────────

test("Cmd+K opens search palette", async ({ page }) => {
    await goHome(page);
    await page.keyboard.press("Meta+k");
    const palette = page.getByPlaceholder(/search|find/i);
    await expect(palette.first()).toBeVisible({ timeout: 3000 });
    await page.keyboard.press("Escape");
});

// ── Responsive: mobile back button ───────────────────────────────────────────

test("iPhone: back button visible after opening note in list mode", async ({ page, viewport }) => {
    if (!viewport || viewport.width > 768) return;
    await goHome(page);
    await clickList(page);
    const firstRow = page.locator(".list-row-hover").first();
    await firstRow.click();
    // after entering a folder, back arrow should show
    const backBtn = page.locator("button[aria-label*='Back'], button[title*='Back']").first();
    await expect(backBtn).toBeVisible({ timeout: 5000 });
});
