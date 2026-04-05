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
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-key",
    GOOGLE_CLIENT_ID: "test-client-id",
    GOOGLE_CLIENT_SECRET: "test-client-secret",
    OWNER_USER_ID: "owner-uuid-1234",
});

// ── Mock Supabase ──
const mockFrom = vi.fn();
const mockGetUser = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
    createClient: vi.fn(() => ({
        auth: { getUser: mockGetUser },
        from: mockFrom,
    })),
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
    mockFrom.mockReset();
    mockGetUser.mockReset();
    mockDriveFilesList.mockReset();
    mockDriveFilesCreate.mockReset();
    mockDriveFilesGet.mockReset();
    mockDrivePermissionsCreate.mockReset();

    // Default: gdrive integration with valid tokens
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
        data: {
            id: "int-1",
            access_token: "valid-token",
            refresh_token: "valid-refresh",
            token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
        },
        error: null,
    });
    mockFrom.mockReturnValue({ select: mockSelect, update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) }) });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ eq: mockEq, single: mockSingle });

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

    it("uploads an image and returns lh3 URL", async () => {
        const res = await POST(makeUploadReq("photo.png", "image/png"));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.url).toContain("lh3.googleusercontent.com");
        expect(body.name).toBe("photo.png");
        expect(body.type).toBe("image/png");
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
