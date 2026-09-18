/**
 * /embed/note/[id] load — the route the native macOS app embeds in WKWebView.
 *
 *   k6 run -e NOTE_ID=<uuid> tests/perf/embed-route.js
 *
 * Requires NOTE_ID env var so we don't synthesize fake UUIDs (the route
 * does a DB lookup and would 404 in cold runs without one).
 */
import http from "k6/http";
import { check } from "k6";
import { BASE_URL, API_KEY, THRESHOLDS } from "./lib/thresholds.js";

const NOTE_ID = __ENV.NOTE_ID;
if (!NOTE_ID) throw new Error("NOTE_ID env var required — pass an existing note's UUID");

export const options = {
    vus: 10,
    duration: "30s",
    thresholds: THRESHOLDS,
};

export default function () {
    const res = http.get(
        `${BASE_URL}/embed/note/${NOTE_ID}?key=${encodeURIComponent(API_KEY)}`,
        { tags: { kind: "critical", endpoint: "embed" } },
    );
    check(res, {
        "status 200": (r) => r.status === 200,
        "renders the editor shell": (r) =>
            typeof r.body === "string" && (r.body.includes("RichEditor") || r.body.includes("Loading")),
    });
}
