/**
 * Shared helpers for integration tests.
 * Creates mock Request objects and reads Response bodies.
 */

export const API_KEY = "test-api-key";
export const USER_ID  = "user-uuid-1234";
export const USER_JWT = "valid-user-jwt-token";

export const ENV = {
    STICKIES_API_KEY:           API_KEY,
    NEXT_PUBLIC_SUPABASE_URL:   "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY:  "test-service-role-key",
    PUSHER_APP_ID:              "app-id",
    PUSHER_KEY:                 "key",
    PUSHER_SECRET:              "secret",
    PUSHER_CLUSTER:             "us2",
};

/** Build a Request with API key auth */
export function apiReq(
    path: string,
    opts: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): Request {
    const { method = "GET", body, headers = {} } = opts;
    const init: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${API_KEY}`,
            ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
            ...headers,
        },
    };
    if (body !== undefined) init.body = JSON.stringify(body);
    return new Request(`http://localhost:4444${path}`, init);
}

/** Build a Request with user JWT auth */
export function userReq(
    path: string,
    opts: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): Request {
    const { method = "GET", body, headers = {} } = opts;
    const init: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${USER_JWT}`,
            "User-Agent": "Mozilla/5.0",
            ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
            ...headers,
        },
    };
    if (body !== undefined) init.body = JSON.stringify(body);
    return new Request(`http://localhost:4444${path}`, init);
}

/** Build a Request with no auth */
export function noAuthReq(path: string, method = "GET"): Request {
    return new Request(`http://localhost:4444${path}`, { method });
}

/** Parse JSON from a Response */
export async function json(res: Response): Promise<any> {
    return res.json();
}

/** Stub note row fixture */
export function noteRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: "note-uuid-1",
        title: "Test Note",
        content: "Hello world",
        folder_name: "Work",
        folder_color: "#34C759",
        folder_id: null,
        parent_folder_name: null,
        is_folder: false,
        type: "text",
        order: 1,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        ...overrides,
    };
}

/** Stub folder row fixture */
export function folderRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: "folder-uuid-1",
        folder_name: "Work",
        folder_color: "#34C759",
        parent_folder_name: null,
        is_folder: true,
        order: 0,
        updated_at: "2026-01-01T00:00:00Z",
        ...overrides,
    };
}
