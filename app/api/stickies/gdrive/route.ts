/**
 * POST /api/stickies/gdrive
 *
 * Uploads a file to Google Drive using OAuth tokens.
 * Structure: My Drive / Stickies / {folder} / file
 *
 * Body: multipart/form-data
 *   file   — the file to upload
 *   folder — folder name (e.g. "Work", "General")
 *
 * Returns: { url, name, type }
 */
import crypto from "crypto";
import { Readable } from "stream";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

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
            const { data: { user } } = await getSupabase().auth.getUser(bearer);
            if (user) return true;
        } catch {}
    }
    return false;
}

/** Get a valid access token, refreshing if needed */
async function getAccessToken(): Promise<string> {
    const supabase = getSupabase();

    const { data } = await supabase
        .from("integrations")
        .select("id, access_token, refresh_token, token_expires_at")
        .eq("type", "gdrive")
        .single();

    if (!data?.refresh_token) throw new Error("Google Drive not connected. Go to Settings → Connect Google Drive.");

    // Return cached access token if still valid (with 60s buffer)
    if (data.access_token && data.token_expires_at) {
        const expiresAt = new Date(data.token_expires_at).getTime();
        if (Date.now() < expiresAt - 60_000) return data.access_token;
    }

    // Refresh the token
    const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            refresh_token: data.refresh_token,
            grant_type: "refresh_token",
        }),
    });

    const tokens = await res.json();
    if (!tokens.access_token) throw new Error("Token refresh failed");

    // Update stored token
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    await supabase
        .from("integrations")
        .update({
            access_token: tokens.access_token,
            token_expires_at: expiresAt,
        })
        .eq("id", data.id);

    return tokens.access_token;
}

/** Find or create a folder inside a parent */
async function findOrCreateFolder(
    drive: ReturnType<typeof google.drive>,
    parentId: string,
    name: string
): Promise<string> {
    const res = await drive.files.list({
        q: `'${parentId}' in parents and name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: "files(id)",
        pageSize: 1,
    });
    if (res.data.files?.length) return res.data.files[0].id!;

    const created = await drive.files.create({
        requestBody: {
            name,
            mimeType: "application/vnd.google-apps.folder",
            parents: [parentId],
        },
        fields: "id",
    });
    return created.data.id!;
}

export async function POST(req: Request) {
    if (!await isAuthorized(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "unsorted";

    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    try {
        const accessToken = await getAccessToken();

        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({ access_token: accessToken });
        const drive = google.drive({ version: "v3", auth: oauth2Client });

        // Find or create "Stickies" root folder in user's Drive
        const stickiesRes = await drive.files.list({
            q: `name = 'Stickies' and mimeType = 'application/vnd.google-apps.folder' and 'root' in parents and trashed = false`,
            fields: "files(id)",
            pageSize: 1,
        });
        let stickiesId: string;
        if (stickiesRes.data.files?.length) {
            stickiesId = stickiesRes.data.files[0].id!;
        } else {
            const created = await drive.files.create({
                requestBody: {
                    name: "Stickies",
                    mimeType: "application/vnd.google-apps.folder",
                },
                fields: "id",
            });
            stickiesId = created.data.id!;
        }

        // Find or create subfolder
        const folderId = await findOrCreateFolder(drive, stickiesId, folder);

        // Upload file
        const buffer = Buffer.from(await file.arrayBuffer());
        const uploaded = await drive.files.create({
            requestBody: {
                name: file.name,
                parents: [folderId],
            },
            media: {
                mimeType: file.type || "application/octet-stream",
                body: Readable.from(buffer),
            },
            fields: "id,webViewLink,webContentLink",
        });

        // Make publicly readable
        await drive.permissions.create({
            fileId: uploaded.data.id!,
            requestBody: { role: "reader", type: "anyone" },
        });

        // Use lh3 direct link for images, webViewLink for others
        const isImage = file.type.startsWith("image/");
        const url = isImage
            ? `https://lh3.googleusercontent.com/d/${uploaded.data.id}`
            : uploaded.data.webViewLink || `https://drive.google.com/file/d/${uploaded.data.id}/view`;

        // Extract text from PDFs
        let extractedText = "";
        if (file.type === "application/pdf") {
            try {
                const pdfMod = await import("pdf-parse");
                const pdfParse = (pdfMod as any).default || pdfMod;
                const pdfData = await pdfParse(buffer);
                extractedText = pdfData.text || "";
            } catch (e) {
                console.error("[gdrive] PDF text extraction failed:", e);
            }
        }

        return NextResponse.json({ url, name: file.name, type: file.type, extractedText });
    } catch (err: any) {
        console.error("[gdrive upload]", err?.message || err);
        return NextResponse.json({ error: err?.message || "Upload failed" }, { status: 500 });
    }
}
