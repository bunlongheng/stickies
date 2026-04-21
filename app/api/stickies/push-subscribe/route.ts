import { authorizeOwner } from "@/app/api/stickies/_auth";
import { execute } from "@/lib/db-driver";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    if (!(await authorizeOwner(req))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { subscription } = await req.json();
    if (!subscription?.endpoint) {
        return NextResponse.json({ error: "Missing subscription" }, { status: 400 });
    }

    try {
        await execute(
            `INSERT INTO push_subscriptions (endpoint, keys, updated_at)
             VALUES ($1, $2, $3)
             ON CONFLICT (endpoint)
             DO UPDATE SET keys = $2, updated_at = $3`,
            [subscription.endpoint, JSON.stringify(subscription.keys), new Date().toISOString()]
        );
    } catch (err) {
        console.error("[push-subscribe POST]", err);
        return NextResponse.json({ error: "DB error" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
