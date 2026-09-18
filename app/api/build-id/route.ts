import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const dynamic = "force-dynamic";

/**
 * The build id currently on disk. A tab compares this against the id it was
 * served with; a difference means the server was rebuilt and this tab's chunk
 * hashes are already gone (#63). Unauthenticated on purpose - it leaks nothing
 * beyond a build hash and must answer before any session work.
 */
export function GET() {
    let id = "";
    try { id = readFileSync(join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim(); } catch { /* dev or bundled */ }
    return NextResponse.json({ id }, { headers: { "Cache-Control": "no-store" } });
}
