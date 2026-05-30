#!/usr/bin/env node
/**
 * Create / list / revoke Stickies API keys.
 *
 * Owner-only: run on M4 against the local dev server (authorized via the LAN
 * bypass, no auth header needed). The keys endpoint rejects machine keys, so
 * this must run locally (or from a logged-in browser).
 *
 *   npm run stickies:key <label>      create a new key (plaintext shown ONCE)
 *   npm run stickies:key list         list keys (no secrets)
 *   npm run stickies:key revoke <id>  revoke a key
 *
 * Override the target with STICKIES_URL (default http://localhost:4444).
 */
const BASE = process.env.STICKIES_URL || "http://localhost:4444";
const EP = `${BASE}/api/stickies/keys`;
const RESERVED = new Set(["list", "revoke", "help", "create", "--help", "-h"]);
const [a0, a1] = process.argv.slice(2);

const usage = () => console.log(
  "Usage:\n" +
  "  npm run stickies:key <label>      create a key (e.g. automations, gv, claude-code)\n" +
  "  npm run stickies:key list         list keys\n" +
  "  npm run stickies:key revoke <id>  revoke a key",
);

async function main() {
  if (!a0 || a0 === "help" || a0 === "--help" || a0 === "-h") return usage();

  try {
    if (a0 === "list") {
      const { keys = [] } = await (await fetch(EP)).json();
      if (!keys.length) return console.log("(no keys yet)");
      for (const k of keys) {
        const tag = k.revoked_at ? "[revoked] " : "";
        console.log(`${tag}${k.id}  ${k.key_prefix}...  ${k.label}  (last used: ${k.last_used_at || "never"})`);
      }
      return;
    }

    if (a0 === "revoke") {
      if (!a1) return console.error("Need a key id:  npm run stickies:key revoke <id>");
      const r = await fetch(`${EP}?id=${encodeURIComponent(a1)}`, { method: "DELETE" });
      return console.log(r.ok ? `Revoked ${a1}` : `Failed (${r.status}): ${await r.text()}`);
    }

    // create: label is a0 (or a1 when called as `create <label>`)
    const label = (a0 === "create" ? a1 : a0);
    if (!label || RESERVED.has(label)) return usage();
    const r = await fetch(EP, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    if (!r.ok) return console.error(`Create failed (${r.status}): ${await r.text()}`);
    const d = await r.json();
    console.log(
      `\n  Created key for "${d.label}"  (id ${d.id})\n\n` +
      `    ${d.key}\n\n` +
      `  Store it in that app's env now - it will NOT be shown again.\n`,
    );
  } catch (e) {
    console.error(`Error: ${e.message}\nIs the Stickies dev server running on ${BASE}?`);
    process.exit(1);
  }
}
main();
