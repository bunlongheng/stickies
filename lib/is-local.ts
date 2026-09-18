/**
 * Returns true when the request originates from a local/LAN host.
 * Used to bypass auth checks during local development while keeping
 * production auth fully enforced.
 */
export function isLocal(request: Request): boolean {
  const host = request.headers.get('host') || '';
  if (LOCAL_RE.test(host)) return true;
  // Fallback: check the URL hostname (useful when host header is absent, e.g. in tests).
  // The Request constructor already validated request.url, so `new URL(...)` can't realistically
  // throw here — but we keep the catch as defense-in-depth.
  try {
    const hostname = new URL(request.url).hostname;
    return LOCAL_RE.test(hostname);
  } catch {
    /* c8 ignore next */
    return false;
  }
}

/** True when this hostname (no port) is a loopback / LAN name. Client-safe. */
export function isLocalHostname(hostname: string): boolean {
  return LOCAL_RE.test(hostname);
}

/**
 * Keyless owner access for LAN callers. Always on outside production (dev
 * convenience). In production it is OFF unless the process opts in with
 * STICKIES_LAN_TRUST=1, which only the M4 hub LaunchAgent sets so a PRODUCTION
 * build can serve LAN devices keyless. Vercel never sets it, and its Host is
 * never local, so production auth there is unchanged.
 */
export function lanTrusted(request: Request): boolean {
  if (!isLocal(request)) return false;
  return process.env.NODE_ENV !== "production" || hubLanTrusted(request);
}

/** The explicit hub opt-in alone: STICKIES_LAN_TRUST=1 AND a local Host. */
export function hubLanTrusted(request: Request): boolean {
  return process.env.STICKIES_LAN_TRUST === "1" && isLocal(request);
}

const LOCAL_RE = /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|.*\.localhost)(:\d+)?$/;
