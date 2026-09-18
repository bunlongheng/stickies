/**
 * Realistic mixed workload — 70% list, 20% single-note GET, 10% PATCH.
 * Best snapshot of "what does normal app traffic look like" for prod.
 *
 *   k6 run -e EXISTING_NOTE_ID=<uuid> tests/perf/mixed.js
 */
import http from "k6/http";
import { check } from "k6";
import { BASE_URL, HEADERS, THRESHOLDS } from "./lib/thresholds.js";

const NOTE_ID = __ENV.EXISTING_NOTE_ID;
if (!NOTE_ID) throw new Error("EXISTING_NOTE_ID env var required — pass an existing note's UUID for the GET + PATCH portions");

export const options = {
    stages: [
        { duration: "20s", target: 15 },
        { duration: "60s", target: 15 },
        { duration: "10s", target: 0 },
    ],
    thresholds: THRESHOLDS,
};

export default function () {
    const r = Math.random();
    if (r < 0.7) {
        // 70% list
        const res = http.get(`${BASE_URL}/api/stickies/ext?limit=50`, {
            headers: HEADERS, tags: { kind: "critical", endpoint: "list" },
        });
        check(res, { "list 200": (x) => x.status === 200 });
    } else if (r < 0.9) {
        // 20% single GET
        const res = http.get(`${BASE_URL}/api/stickies/ext?id=${NOTE_ID}`, {
            headers: HEADERS, tags: { kind: "critical", endpoint: "get" },
        });
        check(res, { "get 200": (x) => x.status === 200 });
    } else {
        // 10% PATCH (touches updated_at only — harmless on existing note)
        const res = http.patch(
            `${BASE_URL}/api/stickies/ext`,
            JSON.stringify({ id: NOTE_ID, updated_at: new Date().toISOString() }),
            { headers: HEADERS, tags: { kind: "critical", endpoint: "patch" } },
        );
        check(res, { "patch 200": (x) => x.status === 200 });
    }
}
