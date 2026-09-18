/**
 * /api/stickies/gdrive/status sanity ping — lightweight enough to use as
 * a uptime / cold-start probe.
 *
 *   k6 run tests/perf/gdrive-status.js
 */
import http from "k6/http";
import { check } from "k6";
import { BASE_URL, HEADERS, THRESHOLDS } from "./lib/thresholds.js";

export const options = {
    vus: 5,
    duration: "20s",
    thresholds: THRESHOLDS,
};

export default function () {
    const res = http.get(`${BASE_URL}/api/stickies/gdrive/status`, {
        headers: HEADERS,
        tags: { kind: "critical", endpoint: "gdrive-status" },
    });
    check(res, {
        "status 200": (r) => r.status === 200,
        "shape has 'connected'": (r) => {
            try { return typeof r.json().connected === "boolean"; } catch { return false; }
        },
    });
}
