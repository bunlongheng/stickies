import fs from "fs";
import readline from "readline";

/**
 * Parse CLI flags and positional args.
 * Returns { flags: Record<string, string>, positional: string[] }
 */
export function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (const arg of argv) {
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq > 0) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      } else {
        flags[arg.slice(2)] = "true";
      }
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}

/**
 * Resolve note content from all input sources.
 * Priority: --file > stdin > positional args > interactive prompt
 */
export async function resolveInput(flags, positional) {
  // 1. --file flag
  if (flags.file) {
    const path = flags.file;
    if (!fs.existsSync(path)) throw new Error(`File not found: ${path}`);
    return fs.readFileSync(path, "utf-8").trim();
  }

  // 2. stdin (piped)
  if (!process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const text = Buffer.concat(chunks).toString("utf-8").trim();
    if (text) return text;
  }

  // 3. positional args
  if (positional.length > 0) {
    return positional.join(" ").trim();
  }

  // 4. interactive prompt
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question("Note content: ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Build the API payload from flags + content.
 */
export function buildPayload(flags, content) {
  if (!content) throw new Error("No content provided");

  const payload = {
    content,
    source: "cli",
  };

  if (flags.title) payload.title = flags.title;
  if (flags.tags) payload.tags = flags.tags.split(",").map((t) => t.trim()).filter(Boolean);
  if (flags.type) payload.type = flags.type;
  if (flags.lang) payload.type = flags.lang;
  if (flags.path) payload.folder_name = flags.path.replace(/^\//, "");

  // Auto-derive title from first line if not provided
  if (!payload.title) {
    const firstLine = content.split("\n").find((l) => l.trim()) || "";
    payload.title = firstLine.replace(/^#+\s*/, "").slice(0, 80).trim() || "Untitled";
  }

  return payload;
}
