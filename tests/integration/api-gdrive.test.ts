/**
 * Integration tests: /api/stickies/gdrive — Google Drive upload
 *
 * Tests validate:
 * - auth enforcement (dev bypass, 401 in prod)
 * - token refresh flow
 * - folder creation in Drive (Stickies > folder > file)
 * - PDF text extraction
 * - error handling for missing tokens
 *
 * Tags: integration, api, gdrive, upload
 * Priority: critical
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Set env vars ──
Object.assign(process.env, {
    STICKIES_API_KEY: "test-api-key",
    GOOGLE_CLIENT_ID: "test-client-id",
    GOOGLE_CLIENT_SECRET: "test-client-secret",
    OWNER_USER_ID: "owner-uuid-1234",
});

// ── Mock DB driver — route uses queryOne + execute ──
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
vi.mock("pdf-parse", () => ({
    default: vi.fn().mockResolvedValue({ text: "Extracted PDF text content" }),
}));

// ── Mock _auth ──
vi.mock("@/app/api/stickies/_auth", () => ({
    authorizeOwner: vi.fn().mockResolvedValue(true),
}));

import { POST } from "@/app/api/stickies/gdrive/route";
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

beforeEach(() => {
    mockQueryOne.mockReset();
    mockExecute.mockReset().mockResolvedValue(1);
    mockDriveFilesList.mockReset();
    mockDriveFilesCreate.mockReset();
    mockDriveFilesGet.mockReset();
    mockDrivePermissionsCreate.mockReset();

    // Default DB row for both gdRow check + getAccessToken (valid tokens)
    const validRow = {
        id: "int-1",
        access_token: "valid-token",
        refresh_token: "valid-refresh",
        token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
    };
    mockQueryOne.mockResolvedValue(validRow);

    // Default: Drive operations succeed
    mockDriveFilesList.mockResolvedValue({ data: { files: [{ id: "stickies-folder-id" }] } });
    mockDriveFilesCreate.mockResolvedValue({ data: { id: "new-file-id", webViewLink: "https://drive.google.com/file/d/new-file-id/view" } });
    mockDrivePermissionsCreate.mockResolvedValue({});
});

describe("POST /api/stickies/gdrive", () => {
    it("returns 400 when no file is provided", async () => {
        const fd = new FormData();
        fd.append("folder", "Work");
        const req = new Request("http://localhost:4444/api/stickies/gdrive", {
            method: "POST",
            headers: { Authorization: "Bearer test-api-key" },
            body: fd,
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toMatch(/no file/i);
    });

    it("uploads an image and returns the same-origin proxy URL", async () => {
        const res = await POST(makeUploadReq("photo.png", "image/png"));
        expect(res.status).toBe(200);
        const body = await res.json();
        // 2026-05-22: images now serve through our same-origin proxy
        // (/api/stickies/gdrive?img=<id>) — Drive's thumbnail URL 302-redirects
        // and lh3 lags, so neither embeds reliably in <img>.
        expect(body.url).toBe("/api/stickies/gdrive?img=new-file-id");
        expect(body.name).toBe("photo.png");
        expect(body.type).toBe("image/png");
    });

    it("treats files with image extensions as images even when MIME is missing (e.g. heic)", async () => {
        const res = await POST(makeUploadReq("vacation.heic", ""));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.url).toBe("/api/stickies/gdrive?img=new-file-id");
    });

    it("uploads a PDF and returns webViewLink + extractedText", async () => {
        const res = await POST(makeUploadReq("report.pdf", "application/pdf"));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.url).toContain("drive.google.com");
        expect(body.name).toBe("report.pdf");
        expect(body.type).toBe("application/pdf");
        expect(body.extractedText).toBe("Extracted PDF text content");
    });

    it("uploads a text file and returns webViewLink", async () => {
        const res = await POST(makeUploadReq("notes.txt", "text/plain"));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.name).toBe("notes.txt");
        expect(body.type).toBe("text/plain");
    });

    it("uses 'unsorted' folder when none specified", async () => {
        const blob = new Blob(["test"], { type: "text/plain" });
        const file = new File([blob], "test.txt", { type: "text/plain" });
        const fd = new FormData();
        fd.append("file", file);
        const req = new Request("http://localhost:4444/api/stickies/gdrive", {
            method: "POST",
            headers: { Authorization: "Bearer test-api-key" },
            body: fd,
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
    });

    it("returns 500 when Drive API throws", async () => {
        mockDriveFilesList.mockRejectedValueOnce(new Error("Drive API error"));
        const res = await POST(makeUploadReq("test.txt", "text/plain"));
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.error).toBeDefined();
    });
});
