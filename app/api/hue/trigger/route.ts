import https from "node:https";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const BRIDGE_IP  = process.env.HUE_BRIDGE_IP?.trim();
const APP_KEY    = process.env.HUE_APP_KEY?.trim();
const GROUP_ID   = process.env.HUE_OFFICE_GROUP_ID?.trim();
const CLIENT_ID  = process.env.HUE_CLIENT_ID?.trim();
const CLIENT_SECRET = process.env.HUE_CLIENT_SECRET?.trim();

function getSupabase() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function hexToXy(hex: string): { x: number; y: number } {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const rL = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    const gL = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    const bL = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
    const X = rL * 0.664511 + gL * 0.154324 + bL * 0.162028;
    const Y = rL * 0.283881 + gL * 0.668433 + bL * 0.047685;
    const Z = rL * 0.000088 + gL * 0.072310 + bL * 0.986039;
    const sum = X + Y + Z;
    if (sum === 0) return { x: 0.3127, y: 0.3290 };
    return { x: Math.round((X / sum) * 10000) / 10000, y: Math.round((Y / sum) * 10000) / 10000 };
}

// Local bridge fetch — only works when server is on same network
function localFetch(path: string, method = "GET", body?: object): Promise<any> {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : undefined;
        const req = https.request({
            hostname: BRIDGE_IP,
            port: 443,
            path,
            method,
            headers: {
                "hue-application-key": APP_KEY!,
                "Content-Type": "application/json",
                ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
            },
            agent: new https.Agent({ rejectUnauthorized: false }),
        }, (res) => {
            let data = "";
            res.on("data", (c) => (data += c));
            res.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
        });
        req.on("error", reject);
        if (payload) req.write(payload);
        req.end();
    });
}

// Get valid Remote API access token (refresh if needed)
async function getRemoteToken(): Promise<string | null> {
    if (!CLIENT_ID || !CLIENT_SECRET) return null;
    const supabase = getSupabase();
    const { data } = await supabase.from("hue_tokens").select("*").eq("id", "remote").single();
    if (!data) return null;

    if (Date.now() < data.expires_at - 60_000) return data.access_token;

    // Refresh
    const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
    const res = await fetch("https://api.meethue.com/v2/oauth2/token", {
        method: "POST",
        headers: { "Authorization": `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: data.refresh_token }),
    });
    if (!res.ok) return null;
    const tokens = await res.json();
    const expires_at = Date.now() + (tokens.expires_in ?? 604800) * 1000;
    await supabase.from("hue_tokens").upsert({
        id: "remote",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? data.refresh_token,
        expires_at,
        updated_at: new Date().toISOString(),
    });
    return tokens.access_token;
}

// POST /api/hue/trigger — flash light via Remote API (cloud) or local bridge (fallback)
export async function POST(req: Request) {
    if (!GROUP_ID) return NextResponse.json({ ok: false, error: "HUE_OFFICE_GROUP_ID not set" }, { status: 503 });
    // Debug env
    console.log("[hue/trigger] GROUP_ID:", JSON.stringify(GROUP_ID), "APP_KEY len:", APP_KEY?.length);

    const body = await req.json().catch(() => ({}));
    const color: string = body.color ?? "#FFCC00";
    const groupId: string = body.group_id ?? GROUP_ID;

    // Quiet hours checked client-side (server runs UTC, not user's timezone)

    const xy = hexToXy(color);

    // 1️⃣ Try Remote API (works from Vercel, anywhere)
    const token = await getRemoteToken();
    if (token) {
        try {
            const base = `https://api.meethue.com/route/clip/v2/resource/grouped_light/${groupId}`;
            const headers = {
                "Authorization": `Bearer ${token}`,
                "hue-application-key": APP_KEY!,
                "Content-Type": "application/json",
            };

            // Check lights are on + save current state
            const stateRes = await fetch(base, { headers });
            const state = await stateRes.json();
            const current = state?.data?.[0];
            const isOn = current?.on?.on === true;
            if (!isOn) return NextResponse.json({ ok: false, reason: "lights off" });

            const origBrightness = current?.dimming?.brightness ?? 100;
            const origXy = current?.color?.xy ?? { x: 0.3127, y: 0.3290 };

            // Flash: set to target color at 20% brightness
            await fetch(base, { method: "PUT", headers, body: JSON.stringify({
                color: { xy },
                dimming: { brightness: 20 },
            }) });

            // Wait 600ms then restore
            await new Promise(r => setTimeout(r, 600));
            await fetch(base, { method: "PUT", headers, body: JSON.stringify({
                color: { xy: origXy },
                dimming: { brightness: origBrightness },
            }) });

            return NextResponse.json({ ok: true, via: "remote", color, xy });
        } catch (e: any) {
            return NextResponse.json({ ok: false, via: "remote-error", error: e?.message }, { status: 500 });
        }
    }

    // 2️⃣ Fallback: local bridge (dev only)
    if (!BRIDGE_IP || !APP_KEY) return NextResponse.json({ ok: false, error: "Hue not configured — visit /api/hue/auth" }, { status: 503 });
    try {
        const state = await localFetch(`/clip/v2/resource/grouped_light/${groupId}`);
        const current = state?.data?.[0];
        const isOn = current?.on?.on === true;
        if (!isOn) return NextResponse.json({ ok: false, reason: "lights off" });
        const origBrightness = current?.dimming?.brightness ?? 100;
        const origXy = current?.color?.xy ?? { x: 0.3127, y: 0.3290 };
        await localFetch(`/clip/v2/resource/grouped_light/${groupId}`, "PUT", { color: { xy }, dimming: { brightness: 20 } });
        await new Promise(r => setTimeout(r, 600));
        await localFetch(`/clip/v2/resource/grouped_light/${groupId}`, "PUT", { color: { xy: origXy }, dimming: { brightness: origBrightness } });
        return NextResponse.json({ ok: true, via: "local", color, xy });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
