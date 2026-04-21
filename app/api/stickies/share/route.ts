import { authorizeOwner } from "@/app/api/stickies/_auth";
import { queryOne, execute } from "@/lib/db-driver";
import { NextResponse } from "next/server";

// POST /api/stickies/share — create a burn-after-read link (auth required)
export async function POST(req: Request) {
    if (!(await authorizeOwner(req))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, content, color, folder_name } = body;

    if (!title && !content) {
        return NextResponse.json({ error: "Empty note" }, { status: 400 });
    }

    const token = crypto.randomUUID();
    const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    try {
        await execute(
            `INSERT INTO shared_notes (token, title, content, color, folder_name, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [token, title ?? "", content ?? "", color ?? "", folder_name ?? "", expires_at]
        );
    } catch (err) {
        console.error("[share POST]", err);
        return NextResponse.json({ error: "DB error" }, { status: 500 });
    }

    return NextResponse.json({ token });
}

// GET /api/stickies/share?token=... — read only, does NOT burn
export async function GET(req: Request) {
    const token = new URL(req.url).searchParams.get("token");
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

    const data = await queryOne(
        `SELECT title, content, color, folder_name FROM shared_notes WHERE token = $1`,
        [token]
    );

    if (!data) {
        return NextResponse.json({ error: "burned" }, { status: 410 });
    }

    return NextResponse.json({
        title: data.title,
        content: data.content,
        color: data.color,
        folder_name: data.folder_name,
    });
}
