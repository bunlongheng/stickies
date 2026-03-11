/**
 * Export all stickies to a git-trackable folder structure.
 * Run: node scripts/export-to-git.mjs
 *
 * Output: ~/stickies-export/
 *   FOLDER_NAME/
 *     note-title.md
 *     note-title.html
 *     note-title.js
 *     ...
 */

import { createClient } from "@supabase/supabase-js";
import { execSync } from "child_process";
import { mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const EXPORT_DIR = join(process.env.HOME, "stickies-export");

const EXT = {
    text:       "md",
    markdown:   "md",
    html:       "html",
    json:       "json",
    javascript: "js",
    typescript: "ts",
    python:     "py",
    css:        "css",
    sql:        "sql",
    bash:       "sh",
    mermaid:    "mmd",
    voice:      "json",
};

function toFilename(title, type) {
    const slug = (title || "untitled")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);
    const ext = EXT[type] ?? "txt";
    return `${slug}.${ext}`;
}

function stripTiptapHtml(html) {
    // Convert TipTap HTML to plain markdown-ish text for text/markdown notes
    return html
        .replace(/<h([1-6])[^>]*>(.*?)<\/h\1>/gi, (_, l, t) => "#".repeat(+l) + " " + t.replace(/<[^>]+>/g, "") + "\n")
        .replace(/<li[^>]*>(.*?)<\/li>/gi, (_, t) => "- " + t.replace(/<[^>]+>/g, "") + "\n")
        .replace(/<p[^>]*>(.*?)<\/p>/gi, (_, t) => t.replace(/<[^>]+>/g, "") + "\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

async function main() {
    console.log("Fetching notes from Supabase…");
    const { data: notes, error } = await sb
        .from("notes")
        .select("id, title, content, folder_name, type, updated_at")
        .eq("is_folder", false)
        .order("folder_name", { ascending: true })
        .order("updated_at", { ascending: false });

    if (error) { console.error("Fetch error:", error.message); process.exit(1); }

    const codeNotes = notes;
    console.log(`Found ${notes.length} notes.`);

    // Init export dir + git repo
    mkdirSync(EXPORT_DIR, { recursive: true });
    if (!existsSync(join(EXPORT_DIR, ".git"))) {
        execSync("git init", { cwd: EXPORT_DIR });
        execSync('git config user.email "stickies@export"', { cwd: EXPORT_DIR });
        execSync('git config user.name "Stickies Export"', { cwd: EXPORT_DIR });
        console.log("Git repo initialized at", EXPORT_DIR);
    }

    // Track filenames per folder to handle duplicates
    const seen = new Map();

    for (const note of codeNotes) {
        const folder = (note.folder_name || "Unsorted").replace(/[/\\]/g, "_");
        const type   = note.type ?? "text";
        const dir    = join(EXPORT_DIR, folder);
        mkdirSync(dir, { recursive: true });

        let filename = toFilename(note.title, type);
        const key = `${folder}/${filename}`;
        if (seen.has(key)) {
            const count = seen.get(key) + 1;
            seen.set(key, count);
            filename = filename.replace(/(\.[^.]+)$/, `-${count}$1`);
        } else {
            seen.set(key, 1);
        }

        let content = note.content ?? "";

        // Clean up TipTap HTML for text/markdown notes
        if ((type === "text" || type === "markdown") && /<[a-z][^>]*>/i.test(content)) {
            content = stripTiptapHtml(content);
        }

        // Add frontmatter
        const header = `---\ntitle: ${note.title || "Untitled"}\ntype: ${type}\nupdated: ${note.updated_at?.slice(0, 10) ?? ""}\n---\n\n`;
        const final = (type === "html" || type === "json") ? content : header + content;

        writeFileSync(join(dir, filename), final, "utf8");
    }

    const REMOTE = "git@github.com:bunlongheng/stickies-air.git";

    // Ensure remote is set
    try {
        const remotes = execSync("git remote", { cwd: EXPORT_DIR }).toString().trim();
        if (!remotes.includes("origin")) {
            execSync(`git remote add origin ${REMOTE}`, { cwd: EXPORT_DIR });
        } else {
            execSync(`git remote set-url origin ${REMOTE}`, { cwd: EXPORT_DIR });
        }
    } catch {}

    // Calculate delta vs previous commit
    execSync("git add -A", { cwd: EXPORT_DIR });
    const diffStat = execSync("git diff --cached --stat", { cwd: EXPORT_DIR }).toString().trim();
    const porcelain = execSync("git diff --cached --name-status", { cwd: EXPORT_DIR }).toString().trim();

    const added    = porcelain.split("\n").filter(l => l.startsWith("A")).length;
    const modified = porcelain.split("\n").filter(l => l.startsWith("M")).length;
    const deleted  = porcelain.split("\n").filter(l => l.startsWith("D")).length;

    const date = new Date().toISOString().slice(0, 19).replace("T", " ");

    if (!porcelain) {
        console.log(`✓ No changes since last export.`);
    } else {
        // Replace history with single fresh commit
        execSync("git checkout --orphan latest_tmp", { cwd: EXPORT_DIR });
        execSync("git add -A", { cwd: EXPORT_DIR });
        execSync(`git commit -m "latest ${date} | +${added} ~${modified} -${deleted}"`, { cwd: EXPORT_DIR });
        try { execSync("git branch -D main", { cwd: EXPORT_DIR }); } catch {}
        execSync("git branch -m main", { cwd: EXPORT_DIR });

        execSync("git push origin main --force", { cwd: EXPORT_DIR });

        console.log(`\nDelta:`);
        if (added)    console.log(`  + ${added} added`);
        if (modified) console.log(`  ~ ${modified} modified`);
        if (deleted)  console.log(`  - ${deleted} deleted`);
        console.log(`\n${diffStat}`);
        console.log(`✓ Pushed → ${REMOTE}`);
    }

    console.log(`\nDone! Your stickies are at:\n  ${EXPORT_DIR}\n`);
}

main();
