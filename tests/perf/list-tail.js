/**
 * Tail latency for the list API under sustained load.
 *
 *   k6 run tests/perf/list-tail.js
 *
 * Ramps to 20 VUs over 30s, holds 1min, ramps down. Pure GET, no writes.
 */
import http from "k6/http";
import { check } from "k6";
import { BASE_URL, HEADERS, THRESHOLDS } from "./lib/thresholds.js";

export const options = {
    stages: [
        { duration: "30s", target: 20 },
        { duration: "60s", target: 20 },
        { duration: "10s", target: 0 },
    ],
    thresholds: THRESHOLDS,
};

export default function () {
    const res = http.get(`${BASE_URL}/api/stickies/ext?limit=50`, {
        headers: HEADERS,
        tags: { kind: "critical", endpoint: "list" },
    });
    check(res, {
        "status 200": (r) => r.status === 200,
        "has notes array": (r) => {
            try { return Array.isArray(r.json().notes); } catch { return false; }
        },
    });
}
