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

// Convert flat node list → readable markdown outline
function nodesToMarkdown(nodes: any[]): string {
    if (!Array.isArray(nodes) || nodes.length === 0) return "";

    const nodeIds = new Set(nodes.map((n: any) => n.id));

    // Root = nodes whose parentId isn't in the set (orphaned = top-level)
    const roots = nodes
        .filter((n: any) => !n.parentId || !nodeIds.has(n.parentId))
        .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    // Build children map
    const childrenMap = new Map<string, any[]>();
    for (const n of nodes) {
        if (n.parentId && nodeIds.has(n.parentId)) {
            if (!childrenMap.has(n.parentId)) childrenMap.set(n.parentId, []);
            childrenMap.get(n.parentId)!.push(n);
        }
    }
    for (const list of childrenMap.values()) {
        list.sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    }

    const lines: string[] = [];

    function walk(node: any, depth: number) {
        const title = (node.title ?? "").trim();
        if (!title) return;
        if (depth === 0) {
            lines.push(`## ${title}`);
        } else {
            lines.push(`${"  ".repeat(depth - 1)}- ${title}`);
        }
        for (const child of childrenMap.get(node.id) ?? []) {
            walk(child, depth + 1);
        }
    }

    for (const root of roots) walk(root, 0);
    return lines.join("\n");
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
            const outline = nodesToMarkdown(idea.nodes);
            const content = `[🗺️ Open in Ideas](${mapUrl})\n\n${outline}`;
            return {
                id: `ext_idea_${idea.id}`,
                title: idea.name,
                content,
                folder_name: "mindmaps",
                parent_folder_name: "Integrations",
                type: "markdown",
                is_folder: false,
                _external: true,
                _source: "bheng:ideas",
                _external_id: idea.id,
                _mapUrl: mapUrl,
                created_at: idea.created_at,
                updated_at: idea.updated_at,
            };
        });
        return NextResponse.json({ notes, total: notes.length });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
