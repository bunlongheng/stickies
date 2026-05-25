/**
 * Integration tests: /api/stickies/gdrive — uncovered paths
 *
 * Targets the gaps not covered by api-gdrive.test.ts:
 * - getAccessToken token-refresh flow (expired token → POST to oauth2 endpoint)
 * - "not connected" → proxy-to-prod path (success + non-ok 502)
 * - catch-block fallback that re-proxies to prod on any failure
 * - PDF text-extraction failure (pdf-parse throws → empty extractedText)
 * - GET ?img= image proxy (400 bad id, 200 stream success, 502 on Drive error)
 *
 * Tags: integration, api, gdrive, proxy, image-proxy
 * Priority: high
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Set env vars ──
Object.assign(process.env, {
    STICKIES_API_KEY: "test-api-key",
    GOOGLE_CLIENT_ID: "test-client-id",
    GOOGLE_CLIENT_SECRET: "test-client-secret",
    OWNER_USER_ID: "owner-uuid-1234",
});

// ── Mock DB driver ──
vi.mock("@/lib/db-driver", () => ({
    query:    vi.fn(),
    queryOne: vi.fn(),
    execute:  vi.fn().mockResolvedValue(1),
}));

// ── Mock googleapis ──
const mockDriveFilesList = vi.fn();
const mockDriveFilesCreate = vi.fn();
const mockDriveFilesGet = vi.fn();
const mockDrivePermissionsCreate = vi.fn();

vi.mock("googleapis", () => {
    class MockOAuth2 { setCredentials() {} }
    return {
        google: {
            auth: { OAuth2: MockOAuth2 },
            drive: vi.fn(() => ({
                files: {
                    list: mockDriveFilesList,
                    create: mockDriveFilesCreate,
                    get: mockDriveFilesGet,
                },
                permissions: { create: mockDrivePermissionsCreate },
            })),
        },
    };
});

// ── Mock pdf-parse ──
const mockPdfParse = vi.fn().mockResolvedValue({ text: "Extracted PDF text content" });
vi.mock("pdf-parse", () => ({ default: mockPdfParse }));

// ── Mock _auth ──
vi.mock("@/app/api/stickies/_auth", () => ({
    authorizeOwner: vi.fn().mockResolvedValue(true),
}));

import { POST, GET } from "@/app/api/stickies/gdrive/route";
import { queryOne, execute } from "@/lib/db-driver";
const mockQueryOne = vi.mocked(queryOne);
const mockExecute  = vi.mocked(execute);

function makeUploadReq(fileName: string, fileType: string, folder = "Work"): Request {
    const blob = new Blob(["test file content"], { type: fileType });
    const file = new File([blob], fileName, { type: fileType });
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", folder);
    return new Request("http://localhost:4444/api/stickies/gdrive", {
        method: "POST",
        headers: { Authorization: "Bearer test-api-key" },
        body: fd,
    });
}

const validTokenRow = () => ({
    id: "int-1",
    access_token: "valid-token",
    refresh_token: "valid-refresh",
    token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
});

beforeEach(() => {
    mockQueryOne.mockReset();
    mockExecute.mockReset().mockResolvedValue(1);
    mockDriveFilesList.mockReset();
    mockDriveFilesCreate.mockReset();
    mockDriveFilesGet.mockReset();
    mockDrivePermissionsCreate.mockReset();
    mockPdfParse.mockReset().mockResolvedValue({ text: "Extracted PDF text content" });
    vi.restoreAllMocks();

    // Default: connected + valid token, Drive ops succeed
    mockQueryOne.mockResolvedValue(validTokenRow());
    mockDriveFilesList.mockResolvedValue({ data: { files: [{ id: "stickies-folder-id" }] } });
    mockDriveFilesCreate.mockResolvedValue({ data: { id: "new-file-id", webViewLink: "https://drive.google.com/file/d/new-file-id/view" } });
    mockDrivePermissionsCreate.mockResolvedValue({});
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST — token refresh
// ═══════════════════════════════════════════════════════════════════════════════
describe("POST /api/stickies/gdrive — token refresh", () => {
    it("refreshes an expired access token before uploading", async () => {
        // Row 1: gdRow connected-check (refresh_token present)
        // Row 2: getAccessToken row — expired so it must refresh
        mockQueryOne
            .mockResolvedValueOnce({ refresh_token: "valid-refresh" })
            .mockResolvedValueOnce({
                id: "int-1",
                access_token: "stale-token",
                refresh_token: "valid-refresh",
                token_expires_at: new Date(Date.now() - 1000).toISOString(), // expired
            });

        const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(
            new Response(JSON.stringify({ access_token: "fresh-token", expires_in: 3600 }), { status: 200 })
        );

        const res = await POST(makeUploadReq("notes.txt", "text/plain"));
        expect(res.status).toBe(200);
        // The oauth2 token endpoint must have been hit
        expect(fetchSpy).toHaveBeenCalledWith("https://oauth2.googleapis.com/token", expect.objectContaining({ method: "POST" }));
        // The refreshed token must have been persisted
        expect(mockExecute).toHaveBeenCalled();
        const updateSql = mockExecute.mock.calls[0][0] as string;
        expect(updateSql).toMatch(/UPDATE integrations SET access_token/);
    });

    it("returns 500 (then fails the prod-fallback) when the token refresh response has no access_token", async () => {
        mockQueryOne
            .mockResolvedValueOnce({ refresh_token: "valid-refresh" })
            .mockResolvedValueOnce({
                id: "int-1",
                access_token: "stale-token",
                refresh_token: "valid-refresh",
                token_expires_at: new Date(Date.now() - 1000).toISOString(),
            });
        // Token refresh returns no access_token → getAccessToken throws → catch → prod fallback also fails
        vi.spyOn(global, "fetch")
            .mockResolvedValueOnce(new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 })) // refresh
            .mockResolvedValueOnce(new Response("nope", { status: 500 }));                                       // prod fallback
        const res = await POST(makeUploadReq("notes.txt", "text/plain"));
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.error).toMatch(/Token refresh failed/);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST — proxy-to-prod when not connected locally
// ═══════════════════════════════════════════════════════════════════════════════
describe("POST /api/stickies/gdrive — proxy to prod when not connected", () => {
    it("proxies to prod and returns prod's JSON when no local refresh_token", async () => {
        mockQueryOne.mockResolvedValueOnce({ refresh_token: null }); // not connected
        const prodJson = { url: "/api/stickies/gdrive?img=prod-id", name: "notes.txt", type: "text/plain" };
        const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(
            new Response(JSON.stringify(prodJson), { status: 200 })
        );
        const res = await POST(makeUploadReq("notes.txt", "text/plain"));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual(prodJson);
        expect(fetchSpy).toHaveBeenCalledWith(
            "https://stickies-bheng.vercel.app/api/stickies/gdrive",
            expect.objectContaining({ method: "POST" })
        );
    });

    it("returns 502 when prod proxy upload fails", async () => {
        mockQueryOne.mockResolvedValueOnce({ refresh_token: null });
        vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response("upstream boom", { status: 503 }));
        const res = await POST(makeUploadReq("notes.txt", "text/plain"));
        expect(res.status).toBe(502);
        const body = await res.json();
        expect(body.error).toMatch(/Prod upload failed \(503\)/);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST — catch-block fallback re-proxies to prod
// ═══════════════════════════════════════════════════════════════════════════════
describe("POST /api/stickies/gdrive — catch-block prod fallback", () => {
    it("returns prod JSON when local upload throws but prod proxy succeeds", async () => {
        // Connected + valid token, but Drive list throws → catch block → prod fallback OK
        mockDriveFilesList.mockRejectedValueOnce(new Error("Drive exploded"));
        const prodJson = { url: "/api/stickies/gdrive?img=recovered", name: "test.txt", type: "text/plain" };
        vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response(JSON.stringify(prodJson), { status: 200 }));
        const res = await POST(makeUploadReq("test.txt", "text/plain"));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual(prodJson);
    });

    it("returns 500 when local upload throws and prod fallback also throws", async () => {
        mockDriveFilesList.mockRejectedValueOnce(new Error("Drive exploded"));
        vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("network down"));
        const res = await POST(makeUploadReq("test.txt", "text/plain"));
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.error).toMatch(/Drive exploded/);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST — PDF extraction failure
// ═══════════════════════════════════════════════════════════════════════════════
describe("POST /api/stickies/gdrive — PDF extraction failure", () => {
    it("returns 200 with empty extractedText when pdf-parse throws", async () => {
        mockPdfParse.mockRejectedValueOnce(new Error("corrupt pdf"));
        const res = await POST(makeUploadReq("broken.pdf", "application/pdf"));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.type).toBe("application/pdf");
        expect(body.extractedText).toBe("");
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST — Stickies root folder creation branch
// ═══════════════════════════════════════════════════════════════════════════════
describe("POST /api/stickies/gdrive — creates Stickies root when missing", () => {
    it("creates the Stickies root folder when Drive has none", async () => {
        // First list (Stickies root) returns no files → must create it
        // Second list (subfolder) also returns none → create subfolder too
        mockDriveFilesList
            .mockResolvedValueOnce({ data: { files: [] } })   // Stickies root: none
            .mockResolvedValueOnce({ data: { files: [] } });  // subfolder: none
        mockDriveFilesCreate
            .mockResolvedValueOnce({ data: { id: "created-stickies-root" } })  // root
            .mockResolvedValueOnce({ data: { id: "created-subfolder" } })       // subfolder
            .mockResolvedValueOnce({ data: { id: "uploaded-file", webViewLink: "https://drive.google.com/file/d/uploaded-file/view" } }); // file
        const res = await POST(makeUploadReq("doc.txt", "text/plain"));
        expect(res.status).toBe(200);
        // create called 3x: root folder, subfolder, file
        expect(mockDriveFilesCreate).toHaveBeenCalledTimes(3);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET ?img= — image proxy
// ═══════════════════════════════════════════════════════════════════════════════
describe("GET /api/stickies/gdrive?img=", () => {
    it("returns 400 when img id is missing", async () => {
        const res = await GET(new Request("http://localhost:4444/api/stickies/gdrive"));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toMatch(/img id required/);
    });

    it("returns 400 when img id has invalid characters", async () => {
        const res = await GET(new Request("http://localhost:4444/api/stickies/gdrive?img=bad/../id"));
        expect(res.status).toBe(400);
    });

    it("streams bytes with correct Content-Type on success", async () => {
        mockDriveFilesGet
            .mockResolvedValueOnce({ data: { mimeType: "image/png" } })                 // meta
            .mockResolvedValueOnce({ data: new Uint8Array([1, 2, 3, 4]).buffer });        // media
        const res = await GET(new Request("http://localhost:4444/api/stickies/gdrive?img=abc123_DEF-456"));
        expect(res.status).toBe(200);
        expect(res.headers.get("Content-Type")).toBe("image/png");
        expect(res.headers.get("Cache-Control")).toMatch(/immutable/);
        const buf = Buffer.from(await res.arrayBuffer());
        expect(buf.length).toBe(4);
    });

    it("falls back to octet-stream when Drive returns no mimeType", async () => {
        mockDriveFilesGet
            .mockResolvedValueOnce({ data: {} })                                          // meta: no mimeType
            .mockResolvedValueOnce({ data: new Uint8Array([9]).buffer });                 // media
        const res = await GET(new Request("http://localhost:4444/api/stickies/gdrive?img=validid"));
        expect(res.status).toBe(200);
        expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
    });

    it("returns 502 when Drive get throws", async () => {
        mockDriveFilesGet.mockRejectedValueOnce(new Error("file gone"));
        const res = await GET(new Request("http://localhost:4444/api/stickies/gdrive?img=validid"));
        expect(res.status).toBe(502);
        expect((await res.json()).error).toMatch(/image fetch failed/);
    });
});
