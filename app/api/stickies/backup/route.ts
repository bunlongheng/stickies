import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

function authorize(req: Request): boolean {
    const auth = req.headers.get("authorization") ?? "";
    const candidates = [process.env.STICKIES_API_KEY, process.env.STICKIES_PASSWORD].filter(Boolean) as string[];
    for (const secret of candidates) {
        const expected = `Bearer ${secret}`;
        if (auth.length !== expected.length) continue;
        try { if (crypto.timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) return true; } catch {}
    }
    return false;
}

// GET /api/stickies/backup         — download as .sql
// GET /api/stickies/backup?format=json — download as .json
export async function GET(req: Request) {
    if (!authorize(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const format = new URL(req.url).searchParams.get("format");
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from("notes")
        .select("*")
        .order("order", { ascending: true });

    if (error) {
        console.error("[stickies/backup GET]", error);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    const rows = data ?? [];
    const now = new Date().toISOString();

    if (format === "json") {
        const filename = `stickies-backup-${now.slice(0, 10)}.json`;
        return new Response(JSON.stringify(rows, null, 2), {
            headers: {
                "Content-Type": "application/json",
                "Content-Disposition": `attachment; filename="${filename}"`,
            },
        });
    }

    // Default: .sql
    const escape = (v: unknown): string => {
        if (v === null || v === undefined) return "NULL";
        if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
        if (typeof v === "number") return String(v);
        return `'${String(v).replace(/'/g, "''")}'`;
    };

    const lines: string[] = [
        `-- stickies backup — ${now}`,
        `-- ${rows.length} rows`,
        ``,
        `TRUNCATE TABLE notes RESTART IDENTITY CASCADE;`,
        ``,
    ];

    for (const row of rows) {
        const cols = Object.keys(row).join(", ");
        const vals = Object.values(row).map(escape).join(", ");
        lines.push(`INSERT INTO notes (${cols}) VALUES (${vals});`);
    }

    const sql = lines.join("\n") + "\n";
    const filename = `stickies-backup-${now.slice(0, 10)}.sql`;

    return new Response(sql, {
        headers: {
            "Content-Type": "application/sql",
            "Content-Disposition": `attachment; filename="${filename}"`,
        },
    });
}

// POST /api/stickies/backup — trigger GitHub Actions workflow now
export async function POST(req: Request) {
    if (!authorize(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = process.env.GITHUB_BACKUP_TOKEN;
    if (!token) {
        return NextResponse.json({ error: "GITHUB_BACKUP_TOKEN not configured" }, { status: 500 });
    }

    const res = await fetch(
        "https://api.github.com/repos/bunlongheng/stickies-backup/actions/workflows/backup.yml/dispatches",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ ref: "main", inputs: { prefix: "manual" } }),
        }
    );

    if (res.status === 204) {
        return NextResponse.json({ ok: true, message: "Backup triggered on GitHub" });
    }

    const body = await res.json().catch(() => ({}));
    console.error("[stickies/backup POST]", res.status, body);
    return NextResponse.json({ error: "GitHub dispatch failed", detail: body }, { status: 500 });
}
