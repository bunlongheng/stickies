import { scryptSync, randomBytes, createHmac, timingSafeEqual } from "node:crypto";

const SCRYPT_KEYLEN = 32;
const SALT_LEN = 16;

/** Hash a plaintext password as `salt$scrypt(password, salt)` (hex). */
export function hashLockPassword(plain: string): string {
    const salt = randomBytes(SALT_LEN);
    const key = scryptSync(plain, salt, SCRYPT_KEYLEN);
    return `${salt.toString("hex")}$${key.toString("hex")}`;
}

/** Constant-time verify a plaintext password against a stored `salt$hash`. */
export function verifyLockPassword(plain: string, stored: string | null): boolean {
    if (!stored || !stored.includes("$")) return false;
    const [saltHex, hashHex] = stored.split("$");
    if (!saltHex || !hashHex) return false;
    try {
        const salt = Buffer.from(saltHex, "hex");
        const expected = Buffer.from(hashHex, "hex");
        const actual = scryptSync(plain, salt, expected.length);
        return expected.length === actual.length && timingSafeEqual(expected, actual);
    } catch { return false; }
}

/** HMAC token proving the holder unlocked `noteId` with the current password hash.
 *  Bound to both noteId and the hash, so rotating the password invalidates old cookies. */
export function signUnlockCookie(noteId: string, lockHash: string): string {
    const secret = process.env.AUTH_SECRET || process.env.STICKIES_API_KEY || "stickies-fallback-secret";
    return createHmac("sha256", secret).update(`${noteId}::${lockHash}`).digest("hex");
}

export function verifyUnlockCookie(noteId: string, lockHash: string, cookie: string | undefined): boolean {
    if (!cookie) return false;
    const expected = signUnlockCookie(noteId, lockHash);
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(cookie, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
}

export function unlockCookieName(noteId: string): string {
    return `stickies_unlock_${noteId.replace(/[^a-z0-9-]/gi, "")}`;
}
