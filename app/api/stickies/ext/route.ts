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
//   DELETE /api/stickies/ext?id=...   — delete note
//   GET    /api/stickies/ext?folder=X — read notes

export { GET, POST, PATCH, DELETE } from "../route";
