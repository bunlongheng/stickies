/**
 * Returns true when the request originates from a local/LAN host.
 * Used to bypass auth checks during local development while keeping
 * production auth fully enforced.
 */
export function isLocal(request: Request): boolean {
  const host = request.headers.get('host') || '';
  if (LOCAL_RE.test(host)) return true;
  // Fallback: check the URL hostname (useful when host header is absent, e.g. in tests)
  try {
    const hostname = new URL(request.url).hostname;
    return LOCAL_RE.test(hostname);
  } catch {
    return false;
  }
}

const LOCAL_RE = /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|.*\.localhost)(:\d+)?$/;
