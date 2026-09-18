#!/usr/bin/env node
/**
 * hub-serve.mjs - keep the M4 hub on :4444 serving the PRODUCTION build.
 *
 * Why: the LaunchAgent used to run `next dev` (Turbopack) as the hub. Dev mode
 * recompiles routes on demand, hot-reloads on every file save and its persistent
 * cache corrupts, so demo loads intermittently painted a white shell. A
 * production build never does any of that.
 *
 * Loop, forever:
 *   port busy   -> someone (npm run dev) owns it: wait and re-check every 15s
 *   build stale -> .next/BUILD_ID missing or older than a SOURCE file: next build first
 *   free        -> next start -p 4444 -H 0.0.0.0; when it exits, loop again
 *
 * Run by ~/Library/LaunchAgents/com.bheng.stickies.plist (copy in scripts/launchd/)
 * with STICKIES_LAN_TRUST=1 so LAN devices keep keyless owner access.
 */
import { spawn } from "node:child_process";
import { existsSync, statSync, readdirSync } from "node:fs";
import net from "node:net";

const PORT = 4444;
const ROOT = new URL("..", import.meta.url).pathname;
const NEXT = `${ROOT}node_modules/.bin/next`;
const log = (m) => console.log(`[hub ${new Date().toISOString()}] ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function portBusy() {
    return new Promise((resolve) => {
        const s = net.createServer();
        s.once("error", () => resolve(true));
        s.once("listening", () => s.close(() => resolve(false)));
        s.listen(PORT, "0.0.0.0");
    });
}

// Source paths that actually affect the compiled output. node_modules, .next and
// .git are excluded: an npm touch or a commit must not force a rebuild.
const SRC = ["app", "components", "lib", "public", "next.config.ts", "package.json", "package-lock.json", "middleware.ts"];

/** Newest mtime under a path, or 0 if it does not exist. */
function newestMtime(rel) {
    const abs = `${ROOT}${rel}`;
    if (!existsSync(abs)) return 0;
    const st = statSync(abs);
    if (!st.isDirectory()) return st.mtimeMs;
    let newest = st.mtimeMs;
    for (const e of readdirSync(abs, { withFileTypes: true })) {
        if (e.name.startsWith(".")) continue;
        const t = newestMtime(`${rel}/${e.name}`);
        if (t > newest) newest = t;
    }
    return newest;
}

/**
 * Rebuild only when a SOURCE file is newer than the build.
 *
 * This used to compare BUILD_ID against the last git commit time, so committing
 * already-built code forced a pointless rebuild - and a rebuild issues new chunk
 * hashes, which is what strands an open tab (#61, #63). A commit that changes no
 * source is now a no-op.
 */
function buildStale() {
    const id = `${ROOT}.next/BUILD_ID`;
    if (!existsSync(id)) return true;
    try {
        const built = statSync(id).mtimeMs;
        return SRC.some((rel) => newestMtime(rel) > built);
    } catch {
        return false;
    }
}

function run(args) {
    return new Promise((resolve) => {
        const p = spawn(NEXT, args, { cwd: ROOT, stdio: "inherit", env: { ...process.env, NODE_ENV: "production" } });
        p.on("exit", (code) => resolve(code ?? 0));
    });
}

for (;;) {
    if (await portBusy()) { await sleep(15000); continue; }
    if (buildStale()) {
        log("build missing or older than HEAD - running next build");
        const code = await run(["build"]);
        if (code !== 0) { log(`build failed (${code}) - retry in 60s`); await sleep(60000); continue; }
    }
    log(`next start on :${PORT}`);
    const code = await run(["start", "-p", String(PORT), "-H", "0.0.0.0"]);
    log(`next start exited (${code}) - re-check in 5s`);
    await sleep(5000);
}
