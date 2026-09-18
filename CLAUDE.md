# stickies - Sticky notes board (port 4444, stickies.localhost)

## Run
- Dev: `npm run dev` (port 4444)
- Build: `npm run build` / Prod: `npm run prod` (next start -p 4444)
- Hub (M4 LaunchAgent `com.bheng.stickies`, copy in `scripts/launchd/`): `npm run hub` = `scripts/hub-serve.mjs` serves the PRODUCTION build on 4444 with `STICKIES_LAN_TRUST=1` (keyless LAN owner access) and `AUTH_TRUST_HOST=true` (Auth.js rejects LAN hosts in production otherwise). `npm run dev` takes the port over while you work; the hub comes back when dev exits. Never point the LaunchAgent at `npm run dev` again - Turbopack dev mode is what caused the intermittent white screens.

## Architecture rules
- Philips Hue: always proxy through a Next.js API route, never fetch the bridge from client-side.
- Hue Remote API requires BOTH Authorization: Bearer and hue-application-key headers.
- /api/stickies/local Hue trigger must use port 4444 internally.

## Auth
- Auth is NextAuth v5 (Auth.js) with Google OAuth; sessions live in Linode Postgres. (Supabase Auth was removed 2026-05-19.)
- Two distinct auth paths (see Security section in memory).
- STICKIES_API_KEY rotated 2026-03-21 - old key invalid; always read from env, never hardcode.

## Never do
- NEVER delete stickies notes - only move, rename, or organize.
- Save Flash Restore pattern (on_off_color) is abandoned - do not reintroduce, unreliable.
- No Co-Authored-By in commits. No Claude mentions in the repo.
- Do not POST to /api/stickies/ext without showing the payload and waiting for confirmation.
- No bulk create/move/rename operations without a proposal first.

## Infra
- Env var trailing newlines cause OAuth %0A failures on Vercel.
- Google Drive for file uploads (user's 2TB), not Supabase Storage.

## Workflow
- Maximize parallel agents and parallel tool calls.

## Test
- Run all tests: `npx vitest run` (or `npm run test`)
- E2E: `npm run test:e2e` (Playwright)

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
