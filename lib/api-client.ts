/**
 * The seam between this app and stickies-api.
 *
 * With NEXT_PUBLIC_STICKIES_API_BASE unset, every call goes to this app's own
 * route handlers exactly as before, so the default build is unchanged. Set it
 * and the same calls go to the standalone service instead. One env var flips
 * the whole client over, and flips it back.
 *
 * The path map exists because stickies-api drops the /api/stickies prefix:
 * the notes surface is /notes, and everything else keeps its last segment.
 */
const BASE = (process.env.NEXT_PUBLIC_STICKIES_API_BASE ?? "").replace(/\/$/, "");

export const usingRemoteApi = BASE !== "";

/** Where the access token lives once the browser has signed in. */
const TOKEN_KEY = "stickies.access_token";

export function apiUrl(path: string): string {
    if (!BASE) return path;
    const [pathname = "", search = ""] = path.split(/(?=\?)/);
    if (!pathname.startsWith("/api/")) return path;
    // NextAuth stays in this app: it owns the sign-in pages and the cookie.
    if (pathname.startsWith("/api/auth/")) return path;

    // /api/stickies and /api/stickies?x=1 are the notes surface.
    if (pathname === "/api/stickies") return `${BASE}/notes${search}`;
    // /api/stickies/keys -> /keys, /api/hue/trigger -> /hue/trigger
    const rest = pathname.replace(/^\/api\/stickies\//, "/").replace(/^\/api\//, "/");
    return `${BASE}${rest}${search}`;
}

/**
 * Drop-in for fetch. Rewrites the URL and, when talking to the remote service,
 * attaches the bearer token. Same-origin calls keep riding the session cookie,
 * which is why credentials are only forced on for the cross-origin case.
 */
export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
    if (!BASE) return fetch(path, init);

    const headers = new Headers(init.headers);
    const token = typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : null;
    // No token is fine on a LAN or dev host: the service trusts local callers.
    // In production it answers 401 and the app sends the user to sign in.
    if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);

    return fetch(apiUrl(path), { ...init, headers, credentials: "include" });
}

export const accessToken = (): string | null =>
    typeof window === "undefined" ? null : window.localStorage.getItem(TOKEN_KEY);
export const setAccessToken = (token: string): void => window.localStorage.setItem(TOKEN_KEY, token);
export const clearAccessToken = (): void => window.localStorage.removeItem(TOKEN_KEY);
