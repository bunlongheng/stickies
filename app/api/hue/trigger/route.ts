import https from "node:https";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const CLIENT_ID     = process.env.HUE_CLIENT_ID?.trim();
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
function localFetch(bridgeIp: string, appKey: string, path: string, method = "GET", body?: object): Promise<any> {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : undefined;
        const req = https.request({
            hostname: bridgeIp,
            port: 443,
            path,
            method,
            headers: {
                "hue-application-key": appKey,
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

// Get valid Remote API access token from integrations row, refresh if needed
async function getRemoteToken(integration: any): Promise<string | null> {
    if (!CLIENT_ID || !CLIENT_SECRET) return null;
    if (!integration.access_token) return null;

    // Token still valid
    if (integration.token_expires_at && Date.now() < new Date(integration.token_expires_at).getTime() - 60_000) {
        return integration.access_token;
    }

    // Refresh
    const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
    const res = await fetch("https://api.meethue.com/v2/oauth2/token", {
        method: "POST",
        headers: { "Authorization": `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: integration.refresh_token }),
    });
    if (!res.ok) return null;

    const tokens = await res.json();
    const token_expires_at = new Date(Date.now() + (tokens.expires_in ?? 604800) * 1000).toISOString();

    await getSupabase().from("integrations").update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? integration.refresh_token,
        token_expires_at,
        updated_at: new Date().toISOString(),
    }).eq("id", integration.id);

    return tokens.access_token;
}

// POST /api/hue/trigger
export async function POST(req: Request) {
    const supabase = getSupabase();

    // Load active Hue integration
    const { data: integration, error } = await supabase
        .from("integrations")
        .select("*")
        .eq("type", "hue")
        .eq("active", true)
        .single();

    if (error || !integration) {
        return NextResponse.json({ ok: false, error: "No active Hue integration found" }, { status: 503 });
    }

    const appKey  = integration.config?.app_key?.trim();
    const groupId = integration.config?.group_id?.trim();
    const bridgeIp = integration.config?.bridge_ip?.trim();

    if (!groupId) return NextResponse.json({ ok: false, error: "group_id not configured" }, { status: 503 });
    if (!appKey)  return NextResponse.json({ ok: false, error: "app_key not configured" }, { status: 503 });

    const body = await req.json().catch(() => ({}));
    const rawColor: string = body.color ?? "#FFCC00";
    const color = /^#[0-9A-Fa-f]{6}$/.test(rawColor) ? rawColor : "#FFCC00";
    const targetGroup = /^[a-zA-Z0-9_-]+$/.test(body.group_id ?? "") ? body.group_id : groupId;

    const xy = hexToXy(color);

    // 1️⃣ Try Remote API
    const token = await getRemoteToken(integration);
    if (token) {
        try {
            const base = `https://api.meethue.com/route/clip/v2/resource/grouped_light/${targetGroup}`;
            const headers = {
                "Authorization": `Bearer ${token}`,
                "hue-application-key": appKey,
                "Content-Type": "application/json",
            };

            const stateRes = await fetch(base, { headers });
            const state = await stateRes.json();
            const current = state?.data?.[0];
            if (current?.on?.on !== true) return NextResponse.json({ ok: false, reason: "lights off" });

            const origBrightness = current?.dimming?.brightness ?? 100;
            const origXy = current?.color?.xy ?? { x: 0.3127, y: 0.3290 };

            await fetch(base, { method: "PUT", headers, body: JSON.stringify({ color: { xy }, dimming: { brightness: 20 } }) });
            await new Promise(r => setTimeout(r, 600));
            await fetch(base, { method: "PUT", headers, body: JSON.stringify({ color: { xy: origXy }, dimming: { brightness: origBrightness } }) });

            return NextResponse.json({ ok: true, via: "remote", color, xy });
        } catch (e: any) {
            return NextResponse.json({ ok: false, via: "remote-error", error: e?.message }, { status: 500 });
        }
    }

    // 2️⃣ Fallback: local bridge
    if (!bridgeIp) return NextResponse.json({ ok: false, error: "No remote token and no bridge_ip configured" }, { status: 503 });
    try {
        const state = await localFetch(bridgeIp, appKey, `/clip/v2/resource/grouped_light/${targetGroup}`);
        const current = state?.data?.[0];
        if (current?.on?.on !== true) return NextResponse.json({ ok: false, reason: "lights off" });

        const origBrightness = current?.dimming?.brightness ?? 100;
        const origXy = current?.color?.xy ?? { x: 0.3127, y: 0.3290 };

        await localFetch(bridgeIp, appKey, `/clip/v2/resource/grouped_light/${targetGroup}`, "PUT", { color: { xy }, dimming: { brightness: 20 } });
        await new Promise(r => setTimeout(r, 600));
        await localFetch(bridgeIp, appKey, `/clip/v2/resource/grouped_light/${targetGroup}`, "PUT", { color: { xy: origXy }, dimming: { brightness: origBrightness } });

        return NextResponse.json({ ok: true, via: "local", color, xy });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
