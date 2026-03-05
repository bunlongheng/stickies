/**
 * POST /api/stickies/gdrive
 *
 * Uploads a file to Google Drive under:
 *   Stickies / {noteId} / image.png
 *
 * Required env vars:
 *   GOOGLE_SERVICE_ACCOUNT_JSON   — full service account JSON (stringified)
 *   GOOGLE_DRIVE_PARENT_FOLDER_ID — ID of the "Stickies" folder in Drive
 *
 * Body: multipart/form-data
 *   file   — the image file
 *   noteId — used as the sub-folder name
 *
 * Returns: { url: string } — publicly accessible direct link
 */

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

async function isAuthorized(req: Request): Promise<boolean> {
    const auth = req.headers.get("authorization") ?? "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
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
    if (bearer) {
        try {
            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
            );
            const { data: { user } } = await supabase.auth.getUser(bearer);
            if (user) return true;
        } catch {}
    }
    return false;
}

export async function POST(req: Request) {
    if (!await isAuthorized(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;

    if (!serviceAccountJson || !parentFolderId) {
        return NextResponse.json(
            { error: "Google Drive not configured" },
            { status: 503 }
        );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const noteId = (formData.get("noteId") as string | null) ?? "unsorted";

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    try {
        const { google } = await import("googleapis");

        const credentials = JSON.parse(serviceAccountJson);
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ["https://www.googleapis.com/auth/drive"],
        });
        const drive = google.drive({ version: "v3", auth });

        // Find or create sub-folder named after the noteId
        const safeName = noteId.replace(/[<>:"/\\|?*]/g, "_").slice(0, 100);

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

        // Upload the file
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const { Readable } = await import("stream");

        const safeName2 = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const uploaded = await drive.files.create({
            requestBody: {
                name: `${Date.now()}-${safeName2}`,
                parents: [subFolderId],
            },
            media: {
                mimeType: file.type || "application/octet-stream",
                body: Readable.from(buffer),
            },
            fields: "id",
        });

        // Make it publicly readable
        await drive.permissions.create({
            fileId: uploaded.data.id!,
            requestBody: { role: "reader", type: "anyone" },
        });

        const url = `https://drive.google.com/uc?export=view&id=${uploaded.data.id}`;
        return NextResponse.json({ url, driveId: uploaded.data.id });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        console.error("[gdrive upload]", err);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
