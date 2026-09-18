// External API entry point — for AI agents, scripts, and automations.
// Uses the same handlers as /api/stickies but callers MUST authenticate
// with the static STICKIES_API_KEY (Bearer token). JWT auth is rejected here.
//
// This route triggers Hue light flash + api-request broadcast on POSTs,
// which the frontend uses to show the "AI activity" notification.
//
// Usage:
//   POST   /api/stickies/ext          — create note
//   PATCH  /api/stickies/ext          — update note
//   GET    /api/stickies/ext?folder=X — read notes
//   DELETE /api/stickies/ext?id=...   — OWNER-SESSION ONLY. API-key callers always
//                                        receive 403 ("No API key may delete"); deletes
//                                        are owner-browser-only by design. Do not rely
//                                        on this verb from an agent/script.

export { GET, POST, PATCH, DELETE } from "../route";
