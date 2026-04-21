import https from "node:https";
import { NextResponse } from "next/server";
import { queryOne, execute } from "@/lib/db-driver";

function localFetch(bridgeIp: string, appKey: string, path: string): Promise<any> {
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: bridgeIp,
            port: 443,
            path,
            method: "GET",
            headers: { "hue-application-key": appKey },
            agent: new https.Agent({ rejectUnauthorized: false }),
        }, (res) => {
            let data = "";
            res.on("data", (c) => (data += c));
            res.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
        });
        req.on("error", reject);
        req.end();
    });
}

async function getRemoteToken(integration: any): Promise<string | null> {
    const CLIENT_ID     = integration.config?.client_id?.trim();
    const CLIENT_SECRET = integration.config?.client_secret?.trim();
    if (!CLIENT_ID || !CLIENT_SECRET) return null;
    if (!integration.access_token) return null;

    if (integration.token_expires_at && Date.now() < new Date(integration.token_expires_at).getTime() - 60_000) {
        return integration.access_token;
    }

    const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
    const res = await fetch("https://api.meethue.com/v2/oauth2/token", {
        method: "POST",
        headers: { "Authorization": `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: integration.refresh_token }),
    });
    if (!res.ok) return null;

    const tokens = await res.json();
    const token_expires_at = new Date(Date.now() + (tokens.expires_in ?? 604800) * 1000).toISOString();

    await execute(
        `UPDATE integrations SET access_token = $1, refresh_token = $2, token_expires_at = $3, updated_at = $4 WHERE id = $5`,
        [tokens.access_token, tokens.refresh_token ?? integration.refresh_token, token_expires_at, new Date().toISOString(), integration.id]
    );

    return tokens.access_token;
}

// GET /api/hue/groups — returns all grouped_light resources
export async function GET() {
    const integration = await queryOne<any>(
        `SELECT * FROM integrations WHERE type = $1 AND active = true LIMIT 1`,
        ["hue"]
    );

    if (!integration) {
        return NextResponse.json({ error: "No active Hue integration found" }, { status: 503 });
    }

    const appKey   = integration.config?.app_key?.trim();
    const bridgeIp = integration.config?.bridge_ip?.trim();

    if (!appKey) return NextResponse.json({ error: "app_key not configured" }, { status: 503 });

    // 1️⃣ Try Remote API
    const token = await getRemoteToken(integration);
    if (token) {
        try {
            const res = await fetch("https://api.meethue.com/route/clip/v2/resource/grouped_light", {
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "hue-application-key": appKey,
                },
            });
            const json = await res.json();
            const groups = (json?.data ?? []).map((g: any) => ({
                id:   g.id,
                name: g.metadata?.name ?? g.id,
                type: g.type ?? "grouped_light",
            }));
            return NextResponse.json({ groups, via: "remote" });
        } catch (e: any) {
            return NextResponse.json({ error: e?.message }, { status: 500 });
        }
    }

    // 2️⃣ Fallback: local bridge
    if (!bridgeIp) return NextResponse.json({ error: "No remote token and no bridge_ip configured" }, { status: 503 });
    try {
        const json = await localFetch(bridgeIp, appKey, "/clip/v2/resource/grouped_light");
        const groups = (json?.data ?? []).map((g: any) => ({
            id:   g.id,
            name: g.metadata?.name ?? g.id,
            type: g.type ?? "grouped_light",
        }));
        return NextResponse.json({ groups, via: "local" });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message }, { status: 500 });
    }
}
