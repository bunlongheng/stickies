/**
 * CSRF state for the Google Drive OAuth flow.
 *
 * The /gdrive/auth start route mints a random state, sets it in an httpOnly
 * SameSite=Lax cookie, AND sends it to Google. The /gdrive/callback verifies the
 * state Google echoes back matches the cookie (constant-time). Because only the
 * browser that STARTED the flow holds the cookie, an attacker-initiated OAuth
 * response cannot bind their Drive account into the owner's integration.
 */
import crypto from "crypto";

export const GDRIVE_STATE_COOKIE = "gdrive_oauth_state";
export const GDRIVE_STATE_MAX_AGE = 600; // 10 minutes - the consent screen's lifetime

export function newOAuthState(): string {
    return crypto.randomBytes(32).toString("hex");
}

/**
 * Constant-time compare of the state Google returned vs the cookie value. Both are
 * 64-char hex strings; the length guard keeps timingSafeEqual from throwing when
 * they differ, and any bad/missing input fails closed.
 */
export function verifyOAuthState(returned: string | null | undefined, cookie: string | null | undefined): boolean {
    if (!returned || !cookie || returned.length !== cookie.length) return false;
    try {
        return crypto.timingSafeEqual(Buffer.from(returned), Buffer.from(cookie));
    } catch {
        return false;
    }
}
