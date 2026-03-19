import { authorizeOwner } from "@/app/api/stickies/_auth";
import { NextResponse } from "next/server";

const PROJECT_REF = process.env.BHENG_SUPABASE_PROJECT_REF!;
const MGMT_TOKEN = process.env.BHENG_SUPABASE_MANAGEMENT_TOKEN!;

const LOCAL_IDEAS_URL = "http://10.0.0.138:5173";
const PROD_IDEAS_URL  = "https://ideas-bheng.vercel.app";

function getIdeasBaseUrl(req: Request): string {
    const host = req.headers.get("host") ?? new URL(req.url).hostname;
    const isLocal = host.startsWith("localhost") || host.startsWith("10.") || host.startsWith("192.168.");
    return isLocal ? LOCAL_IDEAS_URL : PROD_IDEAS_URL;
}

async function queryBheng(sql: string): Promise<Record<string, unknown>[]> {
    const res = await fetch(
        `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${MGMT_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ query: sql }),
            next: { revalidate: 0 },
        }
    );
    if (!res.ok) throw new Error(`Supabase query failed (${res.status})`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

export async function GET(req: Request) {
    if (!await authorizeOwner(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const baseUrl = getIdeasBaseUrl(req);
        const rows = await queryBheng(
            `SELECT id, name, type, nodes, created_at, updated_at FROM ideas ORDER BY updated_at DESC`
        );
        const notes = rows.map((idea: any) => {
            const mapUrl = `${baseUrl}/?map=${idea.id}`;
            const nodeCount = Array.isArray(idea.nodes) ? idea.nodes.length : 0;
            const content = `[🗺️ Open in Ideas](${mapUrl})\n\n**Type:** ${idea.type}  \n**Nodes:** ${nodeCount}  \n**Updated:** ${new Date(idea.updated_at).toLocaleString()}\n\n\`\`\`json\n${JSON.stringify(idea.nodes, null, 2)}\n\`\`\``;
            return {
                id: `ext_idea_${idea.id}`,
                title: idea.name,
                content,
                folder_name: "Ideas",
                parent_folder_name: "Integrations",
                type: "text",
                is_folder: false,
                _external: true,
                _source: "bheng:ideas",
                _external_id: idea.id,
                created_at: idea.created_at,
                updated_at: idea.updated_at,
            };
        });
        return NextResponse.json({ notes, total: notes.length });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
