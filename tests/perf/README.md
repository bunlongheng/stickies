# Performance tests (k6)

Run against either local dev or prod.

## Setup

```bash
brew install k6   # if not already installed
```

Set the API key + target URL once per shell:

```bash
export STICKIES_API_KEY=$(grep '^STICKIES_API_KEY=' .env.local | cut -d= -f2-)
export BASE_URL=http://localhost:4444         # or https://stickies-bheng.vercel.app
```

## Scripts

| Script | What it measures | Run |
|---|---|---|
| `list-tail.js` | GET `/api/stickies/ext` (list API) tail latency under sustained load — establishes p95/p99 baseline | `k6 run tests/perf/list-tail.js` |
| `crud-roundtrip.js` | Full POST + PATCH + GET + DELETE cycle per VU. Catches autosave-style traffic regressions | `k6 run tests/perf/crud-roundtrip.js` |
| `embed-route.js` | The native-WebView `/embed/note/[id]` route under load | `k6 run tests/perf/embed-route.js` |
| `gdrive-status.js` | Lightweight `/api/stickies/gdrive/status` check — sanity test for proxy availability | `k6 run tests/perf/gdrive-status.js` |
| `mixed.js` | Realistic mixed workload: 70% list, 20% GET single note, 10% PATCH | `k6 run tests/perf/mixed.js` |

## Targets / thresholds

All scripts share these floors in `tests/perf/lib/thresholds.js`:

- p95 < 1500ms
- p99 < 3000ms
- error rate < 1%

k6 will exit non-zero if any threshold trips, so these scripts double as
CI guards.

## Common gotchas

- **STICKIES_API_KEY** isn't exposed to k6 unless you `export` it. Otherwise
  every request 401s.
- Hitting prod against your real DB **creates real notes**. Each script
  cleans up after itself, but if you kill mid-run you may see leftover
  `__perf_*` titled rows. Filter and DELETE them:
  `SELECT id FROM stickies WHERE title LIKE '__perf_%'`
- Local dev mode bypasses auth — when `BASE_URL=http://localhost:4444`
  the API key isn't actually checked, but k6 still sends it.
