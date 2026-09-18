// Public share link for a note: /share?noteId=... renders the note's HTML with
// Open Graph preview tags (so iMessage/Slack unfurl a card), by delegating to the
// same handler /raw uses. /raw stays a permanent alias so links already shared
// never break. The old text-copy / clipboard flow (?clip= / ?data=) moved to
// /clip - redirect those here for backward compatibility.
import { GET as rawGET, POST, OPTIONS } from "@/app/api/stickies/public/raw/route";
import { NextResponse } from "next/server";

export { POST, OPTIONS };

export function GET(req: Request) {
    const url = new URL(req.url);
    if (url.searchParams.has("clip") || url.searchParams.has("data")) {
        return NextResponse.redirect(new URL(`/clip${url.search}`, req.url), 308);
    }
    return rawGET(req);
}
