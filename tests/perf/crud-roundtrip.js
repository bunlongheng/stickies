/**
 * Full POST → PATCH → GET → DELETE cycle per VU.
 *
 *   k6 run tests/perf/crud-roundtrip.js
 *
 * Each iteration creates a note titled __perf_<random>, edits it, reads it,
 * deletes it. 5 VUs for 1 minute to keep prod DB load modest.
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, HEADERS, THRESHOLDS } from "./lib/thresholds.js";

export const options = {
    vus: 5,
    duration: "60s",
    thresholds: THRESHOLDS,
};

export default function () {
    const title = `__perf_${__VU}_${__ITER}_${Date.now()}`;
    // POST
    const create = http.post(
        `${BASE_URL}/api/stickies/ext?raw=1`,
        JSON.stringify({ title, content: "perf seed", folder_name: "__perf__" }),
        { headers: HEADERS, tags: { kind: "critical", endpoint: "create" } },
    );
    const okCreate = check(create, { "POST 201": (r) => r.status === 201 });
    if (!okCreate) return;
    const id = create.json("note.id");
    if (!id) return;

    // PATCH
    const patch = http.patch(
        `${BASE_URL}/api/stickies/ext`,
        JSON.stringify({ id, content: "perf seed (edited)" }),
        { headers: HEADERS, tags: { kind: "critical", endpoint: "patch" } },
    );
    check(patch, { "PATCH 200": (r) => r.status === 200 });

    // GET
    const get = http.get(
        `${BASE_URL}/api/stickies/ext?id=${id}`,
        { headers: HEADERS, tags: { kind: "critical", endpoint: "get" } },
    );
    check(get, { "GET 200": (r) => r.status === 200 });

    // DELETE (cleanup)
    const del = http.del(
        `${BASE_URL}/api/stickies/ext?id=${id}`,
        null,
        { headers: HEADERS, tags: { endpoint: "delete" } },
    );
    check(del, { "DELETE 200": (r) => r.status === 200 });

    sleep(0.2);
}
