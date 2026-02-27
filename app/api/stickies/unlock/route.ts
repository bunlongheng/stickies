import { NextResponse } from "next/server";

export async function POST(request: Request) {
    const { password } = await request.json();

    if (!process.env.STICKIES_PASSWORD || password !== process.env.STICKIES_PASSWORD) {
        return NextResponse.json({ ok: false }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set("stickies_auth", password, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: "/",
    });
    return response;
}
