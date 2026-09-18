/**
 * fetch that retries transient failures. A boot request that fails once used to
 * resolve to an empty grid with no retry (blank screen until a manual reload).
 *
 * Retries on a thrown fetch (network) or a 5xx. A 4xx returns immediately: an
 * auth failure must surface at once so the sign-in redirect is not delayed.
 */
export async function fetchRetry(
    input: RequestInfo | URL,
    init?: RequestInit,
    attempts = 3,
    baseDelayMs = 600,
): Promise<Response> {
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
        try {
            const res = await fetch(input, init);
            if (res.status < 500 || i === attempts - 1) return res;
            lastErr = new Error(`HTTP ${res.status}`);
        } catch (e) {
            lastErr = e;
            if (i === attempts - 1) throw e;
        }
        await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** i));
    }
    throw lastErr;
}
