// Read-only integration: fetches all diagrams from the stickies `diagrams` table
// and surfaces them as mermaid notes under Integrations/DIAGRAMS.

import { authorizeOwner } from "@/app/api/stickies/_auth";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const LOCAL_GALLERY_URL = "http://10.0.0.138:3002";
const PROD_GALLERY_URL  = "https://mermaid-bheng.vercel.app";

function getGalleryBaseUrl(req: Request): string {
    const host = req.headers.get("host") ?? new URL(req.url).hostname;
    const isLocal = host.startsWith("localhost") || host.startsWith("10.") || host.startsWith("192.168.");
    return isLocal ? LOCAL_GALLERY_URL : PROD_GALLERY_URL;
}

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}

export async function GET(req: Request) {
    if (!await authorizeOwner(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const { data, error } = await getSupabase()
            .from("diagrams")
            .select("id, title, slug, diagram_type, code, created_at, updated_at")
            .order("updated_at", { ascending: false });

        if (error) throw new Error(error.message);

        const baseUrl = getGalleryBaseUrl(req);

        const notes = (data ?? []).map((d: any) => {
            const galleryUrl = `${baseUrl}/?id=${d.id}&view=1`;
            const content = d.code ?? "";
            return {
                id: `ext_diagram_${d.id}`,
                title: d.title || d.slug || "Untitled Diagram",
                content,
                folder_name: "diagrams",
                parent_folder_name: "Integrations",
                type: "mermaid",
                is_folder: false,
                _external: true,
                _source: "stickies:diagrams",
                _external_id: d.id,
                _mapUrl: galleryUrl,
                created_at: d.created_at,
                updated_at: d.updated_at,
            };
        });

        return NextResponse.json({ notes, total: notes.length });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
