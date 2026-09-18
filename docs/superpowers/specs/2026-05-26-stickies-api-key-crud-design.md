# Stickies API-key CRUD + caller attribution

Date: 2026-05-26
Status: approved (brainstorm), implementing

## Problem
The external API (`/api/stickies/ext`, handlers in `app/api/stickies/route.ts`)
authenticates with ONE shared static `STICKIES_API_KEY`. Every ext-created note
is owned by `OWNER_USER_ID` and there is no record of which machine/agent made a
given note or last used the token. We want per-machine keys (m2m) and attribution.

## Goal
Owner can mint / list / revoke multiple named API keys. Each m2m caller uses its
own key; notes record which key created them, and each key tracks `last_used_at`.

## Decisions (locked)
- Management surface: **API-only** (owner JWT or local dev; no UI).
- Attribution: **note column** `created_by_key` + per-key `last_used_at`.
- Static key: **kept as a fallback** (labeled `legacy`); nothing breaks.
- Key storage: **SHA-256 hash** only; plaintext shown once on create.
- No per-key scopes, no expiry, no rate limiting (YAGNI).
- Key management is **owner-only** and MUST reject API-key auth (a machine key
  cannot mint or revoke keys).

## Data model (ensure-on-use, matching existing `CREATE TABLE IF NOT EXISTS`)
Table `api_keys`:
- `id` UUID PK default `gen_random_uuid()`
- `label` TEXT NOT NULL                    (e.g. "m4-mini", "ci-runner")
- `key_hash` TEXT NOT NULL UNIQUE          (sha-256 hex of the plaintext)
- `key_prefix` TEXT NOT NULL               (first 12 chars, e.g. `sk_a1b2c3d4`, for display)
- `created_at` TIMESTAMPTZ NOT NULL default now()
- `last_used_at` TIMESTAMPTZ
- `revoked_at` TIMESTAMPTZ                 (NULL = active)
- `user_id` UUID NOT NULL                  (= OWNER_USER_ID)

Column on `stickies`: `created_by_key TEXT` (`ADD COLUMN IF NOT EXISTS`). Holds the
key label; NULL for owner/JWT/local creates.

## Key format + hashing (`lib/api-keys.ts`, pure + unit-tested)
- `generateApiKey()` -> `{ plaintext, hash, prefix }`. Plaintext = `sk_` + 32 bytes
  base62 (high entropy). `hash` = `hashApiKey(plaintext)`. `prefix` = first 12 chars.
- `hashApiKey(plaintext)` -> sha-256 hex (deterministic). High-entropy random key,
  so sha-256 is appropriate (not bcrypt).

## Auth (`app/api/stickies/_auth.ts`)
Add `identifyCaller(req): Promise<{ ok, via, keyId?, label? }>` where
`via ∈ 'local'|'static'|'apikey'|'jwt'|null`:
1. `isLocal(req)` -> `{ ok:true, via:'local' }`.
2. Bearer matches static `STICKIES_API_KEY`/`STICKIES_PASSWORD` (timing-safe) ->
   `{ ok:true, via:'static', label:'legacy' }`.
3. Else if Bearer present: sha-256 it, `SELECT id,label FROM api_keys WHERE
   key_hash=$1 AND revoked_at IS NULL`. Hit -> `{ ok:true, via:'apikey', keyId,
   label }` and fire-and-forget `UPDATE api_keys SET last_used_at=now() WHERE id=$1`.
4. Else NextAuth session email == OWNER_EMAIL -> `{ ok:true, via:'jwt' }`.
5. Otherwise `{ ok:false, via:null }`.

`authorizeOwner(req)` becomes `return (await identifyCaller(req)).ok` — all existing
callers keep working unchanged.

## CRUD API (`app/api/stickies/keys/route.ts`) — owner-only
Guard: allowed only when `via ∈ 'local'|'jwt'` (NOT 'static'/'apikey'). Otherwise 403.
- `POST {label}` -> ensure table; mint key; insert (hash, prefix, label); return
  `{ id, label, key: <plaintext>, prefix }` ONCE (201). Reject empty label (400).
- `GET` -> `{ keys: [{ id, label, key_prefix, created_at, last_used_at, revoked_at }] }`.
  Never return hash or plaintext.
- `DELETE ?id=<id>` -> soft revoke: `UPDATE api_keys SET revoked_at=now() WHERE id=$1`.
  Keeps attribution history. 404 if not found.

## Attribution wiring (`app/api/stickies/route.ts` POST note path)
The note-create path calls `identifyCaller(req)` (or receives the auth result) and
sets `created_by_key = label ?? null` on the inserted row. Applies to the single-note
and raw-insert create paths.

## Tests (testing guardrail)
- Unit (`tests/unit/api-keys.test.ts`): `generateApiKey` format (`sk_` prefix, length,
  uniqueness across calls), `hashApiKey` determinism + differs per input, prefix length.
- Integration (`tests/integration/api-keys.test.ts`): mint returns plaintext once;
  GET never leaks hash/plaintext; DELETE revokes; management rejects api-key/static auth
  (403) but allows owner JWT/local; minted-key auth on a note POST stamps
  `created_by_key` + bumps `last_used_at`; revoked key -> 401; legacy static key still works.
  Mock `@/lib/db-driver` and `@/auth` per existing patterns.

## Out of scope
UI, scopes/permissions, expiry, rate limiting, rotating the legacy key.
