// Maps a note's `created_by_key` (the posting app's API-key label) to its app icon.
// Icons are mirrored from the local-apps favicon registry into /public/app-icons so
// they resolve in production (Vercel can't reach the localhost:9876 source at runtime).
const APP_ICON_FILES: Record<string, string> = {
    "3pi": "3pi.png",
    "3pi-poc": "3pi-poc.png",
    "ai-spinner": "ai-spinner.png",
    "audit": "audit.png",
    "automations": "automations.png",
    "bheng": "bheng.png",
    "bheng2020": "bheng2020.png",
    "chrome": "chrome.svg",
    "cl-poster": "cl-poster.png",
    "claude": "claude.png",
    "claude-routine": "claude-routine.png",
    "claude-live": "claude-live.svg",
    "claude-mascot": "claude-mascot.svg",
    "clip": "clip.png",
    "decks": "decks.png",
    "diagrams": "diagrams.png",
    "distributor-portal": "distributor-portal.png",
    "drop": "drop.png",
    "drop-menu": "drop-menu.svg",
    "flash-cards": "flash-cards.png",
    "frames": "frames.png",
    "games": "games.png",
    "ideas": "ideas.svg",
    "kactus": "kactus.png",
    "kactus-qa": "kactus-qa.png",
    "local-apps": "local-apps.png",
    "mermaid": "mermaid.png",
    "mindmaps": "mindmaps.png",
    "moments": "moments.png",
    "norden-study": "norden-study.png",
    "pixel": "pixel.png",
    "pm2020": "pm2020.png",
    "pm2020-tools": "pm2020-tools.png",
    "pm2026": "pm2026.png",
    "recap": "recap.svg",
    "safe": "safe.png",
    "score-card": "score-card.png",
    "stickies": "stickies.png",
    "system-design": "system-design.png",
    "think": "think.png",
    "tools": "tools.png",
    "vault": "vault.png",
};

// Resolve the icon path for an attribution key, or null if none exists (caller
// falls back to a text chip). Tries an exact id match first, then the leading
// segment so suffixed keys like "automations-pipeline" map to "automations".
export function appIconForKey(key: string | null | undefined): string | null {
    if (!key) return null;
    const k = key.toLowerCase();
    const file = APP_ICON_FILES[k] ?? APP_ICON_FILES[k.split("-")[0]];
    return file ? `/app-icons/${file}` : null;
}
