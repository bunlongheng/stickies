#!/usr/bin/env node

import { parseArgs, resolveInput, buildPayload } from "../lib/parse.js";
import { createNote } from "../lib/api.js";

const HELP = `
stickies — create notes via the Stickies API

Usage:
  stickies "some text"            # from args
  echo "some text" | stickies     # from stdin
  stickies --file ./note.md       # from file
  stickies                        # interactive prompt

Flags:
  --title="My Note"       Note title (auto-derived if omitted)
  --tags=ai,ideas         Comma-separated tags
  --type=text|markdown    Note type (auto-detected if omitted)
  --lang=js               Language (sets type)
  --path=/AI              Target folder
  --file=./note.md        Read content from file
  --help                  Show this help

Environment:
  STICKIES_API_URL        Base URL (e.g. https://stickies.vercel.app)
  STICKIES_API_TOKEN      API bearer token
`;

async function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2));

  if (flags.help) {
    console.log(HELP.trim());
    process.exit(0);
  }

  try {
    const content = await resolveInput(flags, positional);
    if (!content) {
      console.error("Error: no content provided");
      process.exit(1);
    }

    const payload = buildPayload(flags, content);
    const result = await createNote(payload);

    console.log(`+ "${result.title}" (${result.id ?? "saved"})`);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
