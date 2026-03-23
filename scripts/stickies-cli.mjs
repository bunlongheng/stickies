#!/usr/bin/env node
/**
 * Stickies CLI — interact with your stickies app from the terminal
 *
 * Usage:
 *   node scripts/stickies-cli.mjs <command> [options]
 *   npm run stickies -- <command> [options]
 *
 * Commands:
 *   new      Create a new note
 *   list     List notes in a folder
 *   folders  List all folders
 *   get      Get a single note by ID
 *   delete   Delete a note by ID
 *   search   Search notes by keyword
 *   post     Pipe stdin as note content
 *
 * Examples:
 *   npm run stickies -- new "My Note" "Content here" --folder CLAUDE
 *   npm run stickies -- list --folder SKILLS
 *   npm run stickies -- folders
 *   npm run stickies -- get abc123
 *   npm run stickies -- delete abc123
 *   npm run stickies -- search "rainbow"
 *   echo "# Title\n\nContent" | npm run stickies -- post
 */

import http from "node:http";
import https from "node:https";
import { readFileSync } from "node:fs";

// ── Config ────────────────────────────────────────────────────────────────────
const LOCAL_URL  = "http://localhost:4444";
const PROD_URL   = "https://stickies-bheng.vercel.app";
const LOCAL_KEY  = "sk_ext_72a5c2daa2602a7ccecddafb04a26e963fd138a2940db174a1c66ac3de5816f9";
const PROD_KEY   = "sk_stickies_d218dfa0abe37b82c5269f40bd478ddca7b567bbd1310efc";

const BRIGHT = [
    "#FF3B30","#FF6B4E","#FF9500","#FFCC00",
    "#D4E157","#34C759","#00C7BE","#32ADE6",
    "#007AFF","#5856D6","#AF52DE","#FF2D55",
];

const RESET  = "\x1b[0m";
const BOLD   = "\x1b[1m";
const DIM    = "\x1b[2m";
const GREEN  = "\x1b[32m";
const CYAN   = "\x1b[36m";
const YELLOW = "\x1b[33m";
const RED    = "\x1b[31m";
const BLUE   = "\x1b[34m";

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function randomColor() {
    return BRIGHT[Math.floor(Math.random() * BRIGHT.length)];
}

async function request(method, path, body, baseUrl, key) {
    const url = new URL(path, baseUrl);
    const lib = url.protocol === "https:" ? https : http;
    const payload = body ? JSON.stringify(body) : undefined;

    return new Promise((resolve, reject) => {
        const req = lib.request({
            hostname: url.hostname,
            port: url.port || (url.protocol === "https:" ? 443 : 80),
            path: url.pathname + url.search,
            method,
            headers: {
                "Authorization": `Bearer ${key}`,
                "Content-Type": "application/json",
                ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
            },
        }, (res) => {
            let data = "";
            res.on("data", c => data += c);
            res.on("end", () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
                catch { resolve({ status: res.statusCode, body: data }); }
            });
        });
        req.on("error", reject);
        if (payload) req.write(payload);
        req.end();
    });
}

async function api(method, path, body = null) {
    // Try local first — only local triggers Hue + screen flash
    try {
        const res = await request(method, path, body, LOCAL_URL, LOCAL_KEY);
        if (res.status < 500) return { ...res, via: "local" };
    } catch { /* local unreachable */ }

    // Fallback to prod
    const res = await request(method, path, body, PROD_URL, PROD_KEY);
    return { ...res, via: "prod" };
}

// ── Formatters ────────────────────────────────────────────────────────────────
function colorSwatch(hex) {
    if (!hex) return "  ";
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return `\x1b[48;2;${r};${g};${b}m  \x1b[0m`;
}

function timeAgo(iso) {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

function printNote(note, i) {
    const swatch = colorSwatch(note.folder_color);
    const id     = `${DIM}${String(note.id).slice(0,8)}…${RESET}`;
    const title  = `${BOLD}${note.title || "(untitled)"}${RESET}`;
    const type   = note.type ? `${DIM}[${note.type}]${RESET}` : "";
    const ago    = `${DIM}${timeAgo(note.updated_at)}${RESET}`;
    const prefix = i !== undefined ? `${DIM}${String(i+1).padStart(3)}.${RESET} ` : "     ";
    console.log(`${prefix}${swatch} ${id} ${title} ${type} ${ago}`);
}

// ── Commands ──────────────────────────────────────────────────────────────────
const commands = {

    async new(args) {
        const title   = args[0];
        const content = args[1] ?? "";
        const folder  = flag(args, "--folder") ?? flag(args, "-f") ?? "CLAUDE";
        const color   = flag(args, "--color")  ?? flag(args, "-c") ?? randomColor();

        if (!title) { die("Usage: new <title> [content] [--folder FOLDER] [--color #HEX]"); }
        if (!content.trim()) { die("Content cannot be empty."); }

        console.log(`${CYAN}Creating note…${RESET}`);
        const res = await api("POST", "/api/stickies/ext", { title, content, folder, color });
        if (res.status === 201) {
            const note = res.body.note;
            console.log(`${GREEN}✓ Created${RESET} ${DIM}via ${res.via}${RESET}`);
            printNote(note);
        } else {
            die(`Error ${res.status}: ${JSON.stringify(res.body)}`);
        }
    },

    async list(args) {
        const folder = flag(args, "--folder") ?? flag(args, "-f") ?? "CLAUDE";
        console.log(`${CYAN}Fetching notes in ${BOLD}${folder}${RESET}${CYAN}…${RESET}`);
        const res = await api("GET", `/api/stickies/ext?folder=${encodeURIComponent(folder)}`);
        if (res.status !== 200) die(`Error ${res.status}: ${JSON.stringify(res.body)}`);

        const notes = (res.body.notes ?? res.body ?? []).filter(n => !n.is_folder);
        if (!notes.length) { console.log(`${DIM}No notes found.${RESET}`); return; }
        console.log(`${DIM}${notes.length} note${notes.length !== 1 ? "s" : ""} in ${folder}${RESET}\n`);
        notes.forEach((n, i) => printNote(n, i));
    },

    async folders(args) {
        console.log(`${CYAN}Fetching folders…${RESET}`);
        const res = await api("GET", "/api/stickies/ext?folders=1");
        if (res.status !== 200) die(`Error ${res.status}: ${JSON.stringify(res.body)}`);

        const folders = (res.body.notes ?? res.body ?? []).filter(n => n.is_folder);
        if (!folders.length) { console.log(`${DIM}No folders found.${RESET}`); return; }
        console.log(`${DIM}${folders.length} folder${folders.length !== 1 ? "s" : ""}${RESET}\n`);
        folders.forEach((f, i) => {
            const swatch = colorSwatch(f.color ?? f.folder_color);
            const name   = `${BOLD}${f.name ?? f.folder_name}${RESET}`;
            const count  = f.count ? `${DIM}${f.count} notes${RESET}` : "";
            console.log(`  ${String(i+1).padStart(3)}. ${swatch} ${name} ${count}`);
        });
    },

    async get(args) {
        const id = args[0];
        if (!id) die("Usage: get <id>");
        const res = await api("GET", `/api/stickies/ext?id=${id}`);
        if (res.status !== 200) die(`Error ${res.status}: ${JSON.stringify(res.body)}`);
        const note = res.body.note ?? res.body;
        printNote(note);
        console.log(`\n${note.content ?? ""}\n`);
    },

    async delete(args) {
        const id = args[0];
        if (!id) die("Usage: delete <id>");
        console.log(`${YELLOW}Deleting ${id}…${RESET}`);
        const res = await api("DELETE", `/api/stickies/ext?id=${id}`);
        if (res.status === 200 || res.status === 204) {
            console.log(`${GREEN}✓ Deleted${RESET}`);
        } else {
            die(`Error ${res.status}: ${JSON.stringify(res.body)}`);
        }
    },

    async search(args) {
        const query = args[0];
        if (!query) die("Usage: search <query>");
        console.log(`${CYAN}Searching for "${query}"…${RESET}`);
        const res = await api("GET", `/api/stickies/ext?search=${encodeURIComponent(query)}`);
        if (res.status !== 200) die(`Error ${res.status}: ${JSON.stringify(res.body)}`);
        const notes = (res.body.notes ?? res.body ?? []).filter(n => !n.is_folder);
        if (!notes.length) { console.log(`${DIM}No results.${RESET}`); return; }
        console.log(`${DIM}${notes.length} result${notes.length !== 1 ? "s" : ""}${RESET}\n`);
        notes.forEach((n, i) => printNote(n, i));
    },

    async post(args) {
        // Read from stdin
        const folder = flag(args, "--folder") ?? flag(args, "-f") ?? "CLAUDE";
        const color  = flag(args, "--color")  ?? flag(args, "-c") ?? randomColor();
        const raw = await readStdin();
        const lines = raw.trim().split("\n");
        const titleLine = lines[0].replace(/^#+\s*/, "").trim();
        const content = lines.slice(1).join("\n").trim();
        if (!content) die("Content cannot be empty.");
        console.log(`${CYAN}Posting to ${folder}…${RESET}`);
        const res = await api("POST", "/api/stickies/ext", {
            title: titleLine || "Untitled",
            content,
            folder,
            color,
        });
        if (res.status === 201) {
            console.log(`${GREEN}✓ Posted${RESET} ${DIM}via ${res.via}${RESET}`);
            printNote(res.body.note);
        } else {
            die(`Error ${res.status}: ${JSON.stringify(res.body)}`);
        }
    },

    help() {
        console.log(`
${BOLD}Stickies CLI${RESET}

${CYAN}Commands:${RESET}
  ${BOLD}new${RESET} <title> <content> [--folder F] [--color #HEX]   Create a note
  ${BOLD}list${RESET} [--folder F]                                    List notes
  ${BOLD}folders${RESET}                                              List folders
  ${BOLD}get${RESET} <id>                                             Get note by ID
  ${BOLD}delete${RESET} <id>                                          Delete note
  ${BOLD}search${RESET} <query>                                       Search notes
  ${BOLD}post${RESET} [--folder F]                                    Post from stdin

${CYAN}Examples:${RESET}
  npm run stickies --new "My Note" "Hello world" --folder CLAUDE
  npm run stickies --list --folder SKILLS
  npm run stickies --folders
  npm run stickies --search "rainbow"
  npm run stickies --delete abc12345
  echo "# Title\\n\\nContent" | npm run stickies --post --folder IDEAS

${DIM}Always tries localhost:4444 first (triggers Hue + screen flash),
falls back to stickies-bheng.vercel.app if local is unreachable.${RESET}
`);
    },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function flag(args, name) {
    const i = args.indexOf(name);
    return i !== -1 && args[i + 1] ? args[i + 1] : null;
}

function die(msg) {
    console.error(`${RED}✗ ${msg}${RESET}`);
    process.exit(1);
}

function readStdin() {
    return new Promise((resolve) => {
        let data = "";
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", c => data += c);
        process.stdin.on("end", () => resolve(data));
        if (process.stdin.isTTY) resolve("");
    });
}

// ── Main ──────────────────────────────────────────────────────────────────────
const [,, cmd, ...args] = process.argv;

if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    commands.help();
} else if (commands[cmd]) {
    commands[cmd](args).catch(e => die(e.message));
} else {
    die(`Unknown command: ${cmd}. Run with no args to see help.`);
}
