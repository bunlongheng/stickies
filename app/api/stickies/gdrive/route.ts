/**
 * POST /api/stickies/gdrive
 *
 * Uploads a file to Google Drive, placing it in a folder named after the note.
 * Structure mirrors local intent:
 *   My Drive / Stickies / {noteTitle} / image-1.png
 *
 * Required env vars (.env.local):
 *   GOOGLE_SERVICE_ACCOUNT_JSON   — full service account JSON (stringified)
 *   GOOGLE_DRIVE_PARENT_FOLDER_ID — ID of the "Stickies" parent folder in Drive
 *                                    (share this folder with the service account email)
 *
 * Body: multipart/form-data
 *   file      — the image file
 *   noteTitle — used as the sub-folder name
 *
 * Returns: { url: string } — publicly shareable direct link
 */

import crypto from "crypto";
import { NextResponse } from "next/server";

function authorize(req: Request): boolean {
    const auth = req.headers.get("authorization") ?? "";
    const candidates = [
        process.env.STICKIES_API_KEY,
        process.env.STICKIES_PASSWORD,
    ].filter(Boolean) as string[];
    for (const secret of candidates) {
        const expected = `Bearer ${secret}`;
        if (auth.length !== expected.length) continue;
        try {
            if (crypto.timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) return true;
        } catch {}
    }
    return false;
}

export async function POST(req: Request) {
    if (!authorize(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;

    if (!serviceAccountJson || !parentFolderId) {
        return NextResponse.json(
            { error: "Google Drive not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_DRIVE_PARENT_FOLDER_ID in .env.local" },
            { status: 503 }
        );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const noteTitle = (formData.get("noteTitle") as string | null) ?? "Untitled";

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    try {
        // Dynamically import googleapis (install with: npm install googleapis)
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore — googleapis optional; install when ready to use GDrive
        const { google } = await import("googleapis");

        const credentials = JSON.parse(serviceAccountJson);
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ["https://www.googleapis.com/auth/drive"],
        });
        const drive = google.drive({ version: "v3", auth });

        // 1. Find or create sub-folder named after the note
        const safeName = noteTitle.replace(/[<>:"/\\|?*]/g, "_").slice(0, 100);

        const folderSearch = await drive.files.list({
            q: `name='${safeName}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: "files(id)",
        });

        let subFolderId: string;
        if (folderSearch.data.files?.length) {
            subFolderId = folderSearch.data.files[0].id!;
        } else {
            const created = await drive.files.create({
                requestBody: {
                    name: safeName,
                    mimeType: "application/vnd.google-apps.folder",
                    parents: [parentFolderId],
                },
                fields: "id",
            });
            subFolderId = created.data.id!;
        }

        // 2. Upload the file into that sub-folder
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const { Readable } = await import("stream");

        const uploaded = await drive.files.create({
            requestBody: {
                name: file.name,
                parents: [subFolderId],
            },
            media: {
                mimeType: file.type || "application/octet-stream",
                body: Readable.from(buffer),
            },
            fields: "id, webContentLink, webViewLink",
        });

        // 3. Make it publicly readable
        await drive.permissions.create({
            fileId: uploaded.data.id!,
            requestBody: { role: "reader", type: "anyone" },
        });

        // Direct download link
        const url = `https://drive.google.com/uc?export=view&id=${uploaded.data.id}`;

        return NextResponse.json({ url, driveId: uploaded.data.id });
    } catch (err: any) {
        console.error("[gdrive upload]", err);
        return NextResponse.json({ error: err.message ?? "Upload failed" }, { status: 500 });
    }
}
