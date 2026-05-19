/**
 * Shared k6 thresholds + env-var helpers.
 * All scripts import these so the bar moves in one place.
 */

export const BASE_URL = __ENV.BASE_URL || "http://localhost:4444";
export const API_KEY  = __ENV.STICKIES_API_KEY || "";

if (!API_KEY) {
    // k6 doesn't have a great pre-flight, but throwing here at module load
    // means each VU bails immediately with a readable message.
    throw new Error("STICKIES_API_KEY is required — export it before running k6");
}

export const HEADERS = {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
};

export const THRESHOLDS = {
    // Sustained-load floors. Move them up over time; never lower without an
    // explicit reason (and a comment).
    "http_req_duration{kind:critical}": ["p(95)<1500", "p(99)<3000"],
    "http_req_failed":                  ["rate<0.01"],
    "checks":                           ["rate>0.99"],
};
