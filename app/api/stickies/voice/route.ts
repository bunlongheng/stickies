import crypto from "crypto";
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

const BHENG_BASE = process.env.BHENG_BASE_URL ?? "http://localhost:3000";
const STICKIES_API_KEY = process.env.STICKIES_API_KEY ?? "";

// POST /api/stickies/voice
// multipart/form-data: file (audio blob), noteId (string), duration (seconds)
// Returns { audioUrl, transcript, summary, duration }
export async function POST(req: Request) {
    if (!await isAuthorized(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const noteId = (formData.get("noteId") as string | null) ?? "unsorted";
    const duration = Number(formData.get("duration") ?? 0);

    if (!file) return NextResponse.json({ error: "No audio file" }, { status: 400 });

    // ── 1. Upload audio to Supabase Storage ──────────────────────────────────
    const ext = file.type.includes("mp4") ? "m4a" : "webm";
    const path = `voice/${noteId}/${Date.now()}.${ext}`;
    const supabase = getSupabase();

    const { error: uploadError } = await supabase.storage
        .from("stickies-files")
        .upload(path, await file.arrayBuffer(), {
            contentType: file.type || "audio/webm",
            upsert: false,
        });

    if (uploadError) {
        return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: { publicUrl: audioUrl } } = supabase.storage
        .from("stickies-files")
        .getPublicUrl(path);

    // ── 2. Transcribe via bheng Whisper proxy ─────────────────────────────────
    let transcript = "";
    try {
        const whisperForm = new FormData();
        whisperForm.append("file", file, `voice.${ext}`);
        const whisperRes = await fetch(`${BHENG_BASE}/api/whisper`, {
            method: "POST",
            headers: { "x-whisper-key": STICKIES_API_KEY },
            body: whisperForm,
        });
        if (whisperRes.ok) {
            const data = await whisperRes.json();
            transcript = data.text ?? "";
        }
    } catch (err) {
        console.warn("Whisper transcription failed:", err);
    }

    // ── 3. Summarize via bheng ────────────────────────────────────────────────
    let summary = "";
    if (transcript) {
        try {
            const sumRes = await fetch(`${BHENG_BASE}/api/summarize`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-whisper-key": STICKIES_API_KEY },
                body: JSON.stringify({ transcript }),
            });
            if (sumRes.ok) {
                const data = await sumRes.json();
                summary = data.summary ?? "";
            }
        } catch (err) {
            console.warn("Summarize failed:", err);
        }
    }

    return NextResponse.json({ audioUrl, transcript, summary, duration });
}
