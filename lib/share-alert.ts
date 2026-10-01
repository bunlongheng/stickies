// Who opened a passcode-gated share link. Fires once per successful unlock:
// every view is written to share_unlock_log (so nothing is lost before an email
// provider is configured) and emailed to OWNER_EMAIL when RESEND_API_KEY is set.
//
// Never throws and never blocks the response - a failed alert must not stop a
// paying client from reading the invoice.
import { execute, query } from "@/lib/db-driver";

export interface ShareVisit {
    noteId: string;
    title: string;
    ip: string;
    city: string | null;
    country: string | null;
    userAgent: string | null;
    referer: string | null;
    /** The share link as the visitor requested it. */
    url: string;
    at: Date;
    /** "unlock" = passcode entered, "view" = open link opened. */
    kind: "unlock" | "view";
    geo?: IpGeo;
}

/** Link-preview crawlers (iMessage, Slack, WhatsApp, Twitter, Facebook) fetch a shared URL without a person behind it. */
export function isBot(userAgent: string | null): boolean {
    return /bot|crawler|spider|preview|facebookexternalhit|slackbot|twitterbot|whatsapp|telegram|discord|skype|linkedin|embedly|quora|pinterest|vkshare|w3c_validator|applebot|google-structured|headless/i.test(userAgent || "");
}

/** ipinfo.io fields for the visitor's IP (the old SSH-login email layout). */
export interface IpGeo {
    hostname: string | null;
    city: string | null;
    region: string | null;
    country: string | null;
    loc: string | null;
    org: string | null;
    postal: string | null;
    timezone: string | null;
}

const PRIVATE_IP = /^(unknown|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80)/i;

/** Enrich a public IP via ipinfo.io (keyless; IPINFO_TOKEN lifts the rate limit). 3 s cap, null on any failure. */
export async function lookupIp(ip: string): Promise<IpGeo | null> {
    if (PRIVATE_IP.test(ip)) return null;
    try {
        const token = process.env.IPINFO_TOKEN ? `?token=${process.env.IPINFO_TOKEN}` : "";
        const res = await fetch(`https://ipinfo.io/${encodeURIComponent(ip)}/json${token}`, { signal: AbortSignal.timeout(3000) });
        if (!res.ok) return null;
        const j = await res.json();
        const pick = (k: string) => (typeof j[k] === "string" && j[k] ? j[k] : null);
        return { hostname: pick("hostname"), city: pick("city"), region: pick("region"), country: pick("country"),
            loc: pick("loc"), org: pick("org"), postal: pick("postal"), timezone: pick("timezone") };
    } catch { return null; }
}

/** First hop of x-forwarded-for is the real client on Vercel; others are proxies. */
export function clientIp(req: Request): string {
    const h = req.headers;
    const raw = h.get("x-vercel-forwarded-for") || h.get("x-forwarded-for") || h.get("x-real-ip") || "";
    return raw.split(",")[0].trim() || "unknown";
}

export function readVisit(req: Request, noteId: string, title: string, kind: "unlock" | "view" = "unlock"): ShareVisit {
    const h = req.headers;
    return {
        noteId,
        kind,
        title: title || "Untitled",
        ip: clientIp(req),
        city: h.get("x-vercel-ip-city") ? decodeURIComponent(h.get("x-vercel-ip-city")!) : null,
        country: h.get("x-vercel-ip-country"),
        userAgent: h.get("user-agent"),
        referer: h.get("referer"),
        url: req.url,
        at: new Date(),
    };
}

async function logVisit(v: ShareVisit): Promise<void> {
    await execute(`CREATE TABLE IF NOT EXISTS share_unlock_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        note_id UUID NOT NULL,
        title TEXT,
        ip TEXT,
        city TEXT,
        country TEXT,
        user_agent TEXT,
        referer TEXT,
        emailed BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    await execute(`ALTER TABLE share_unlock_log ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'unlock'`);
    await execute(
        `INSERT INTO share_unlock_log (note_id, title, ip, city, country, user_agent, referer, emailed, kind)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [v.noteId, v.title, v.ip, v.city, v.country, v.userAgent, v.referer, false, v.kind]
    );
}

function emailBody(v: ShareVisit, viewNumber: number): string {
    const g = v.geo;
    const city = g?.city || v.city;
    const country = g?.country || v.country;
    const when = v.at.toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }) + " ET";
    const [lat, lon] = (g?.loc || "").split(",");
    const mapUrl = lat && lon
        ? `https://static-maps.yandex.ru/1.x/?lang=en_US&ll=${lon},${lat}&z=9&size=600,300&l=map&pt=${lon},${lat},pm2rdm`
        : null;
    const row = (k: string, val: string | null) =>
        `<tr><td style="padding:7px 16px 7px 0;color:#71717a;font-size:13px;white-space:nowrap;vertical-align:top">${k}</td>` +
        `<td style="padding:7px 0;color:#18181b;font-size:14px;font-weight:600;word-break:break-word">${val ? escapeHtml(val) : "<span style=\"color:#a1a1aa;font-weight:400\">unknown</span>"}</td></tr>`;
    return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;padding:8px 0 24px;color:#18181b">
  <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#a1a1aa;font-weight:700;margin-bottom:6px">Stickies share - ${v.kind === "unlock" ? "passcode unlock" : "link opened"}</div>
  <h1 style="font-size:20px;line-height:1.35;margin:0 0 14px;color:#18181b">Someone opened "${escapeHtml(v.title)}"</h1>
  <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#3f3f46">Someone from <b>${escapeHtml(v.ip)}</b> ${v.kind === "unlock" ? "entered the passcode" : "opened the shared link"} on <b>${when}</b>${country ? ` from <b style="color:#ef4444">${escapeHtml(country)}</b>` : ""}. This is view <b>${viewNumber}</b> of this note.</p>
  <table style="border-collapse:collapse;width:100%;max-width:100%;border-top:1px solid #e4e4e7;border-bottom:1px solid #e4e4e7;margin:0 0 18px">
    ${row("Target IP", v.ip)}
    ${row("Hostname", g?.hostname ?? null)}
    ${row("City", city)}
    ${row("Region", g?.region ?? null)}
    ${row("Country", country)}
    ${row("Coordinates", g?.loc ?? null)}
    ${row("Org", g?.org ?? null)}
    ${row("Postal", g?.postal ?? null)}
    ${row("Timezone", g?.timezone ?? null)}
    ${row("Referrer", v.referer || "direct")}
    <tr><td style="padding:7px 16px 7px 0;color:#71717a;font-size:13px;white-space:nowrap;vertical-align:top">Link</td><td style="padding:7px 0;font-size:14px;font-weight:600;word-break:break-all"><a href="${escapeHtml(v.url)}" style="color:#2563eb">${escapeHtml(v.url)}</a></td></tr>
  </table>
  ${mapUrl ? `<img src="${mapUrl}" alt="Map near ${escapeHtml(city || v.ip)}" width="600" height="300" style="display:block;max-width:100%;height:auto;border-radius:10px;border:1px solid #e4e4e7;margin:0 0 18px">` : ""}
  <p style="margin:0 0 6px;font-size:14px;color:#3f3f46">More detail: <a href="https://ipinfo.io/${encodeURIComponent(v.ip)}" style="color:#2563eb">ipinfo.io/${escapeHtml(v.ip)}</a></p>
  <p style="margin:0;color:#a1a1aa;font-size:12px;word-break:break-all">${escapeHtml(v.userAgent || "no user agent")}</p>
</div>`;
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

async function sendEmail(v: ShareVisit, viewNumber: number): Promise<boolean> {
    const key = process.env.RESEND_API_KEY;
    const to = process.env.OWNER_EMAIL;
    if (!key || !to) return false;
    const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            from: process.env.SHARE_ALERT_FROM || "Stickies <onboarding@resend.dev>",
            to: [to],
            subject: `Opened: ${v.title} - ${v.ip}`,
            html: emailBody(v, viewNumber),
        }),
    });
    return res.ok;
}

/**
 * No email provider configured yet: drop the alert into the owner's own board
 * instead, so a visit is never silent. Same database, no API key, and it shows
 * up on the phone like any other note.
 */
async function postAlertNote(v: ShareVisit, viewNumber: number): Promise<void> {
    const userId = process.env.OWNER_USER_ID;
    if (!userId) return;
    await execute(
        `INSERT INTO "stickies" (user_id, title, content, folder_name, folder_color, is_folder, type, "order", created_by_key, created_by_machine, icon)
         VALUES ($1, $2, $3, 'Alerts', '#FF3B30', false, 'html', 0, 'share-alert', 'hub', '__hero:EyeIcon')`,
        [
            userId,
            `Opened: ${v.title.replace(/^(Opened:\s*)+/, "")}`,
            emailBody(v, viewNumber),
        ]
    );
}

/** Fire-and-forget. Call without awaiting; it swallows its own failures. */
export async function notifyShareUnlock(v: ShareVisit): Promise<void> {
    try {
        await logVisit(v);
        const rows = await query<{ n: string }>(
            `SELECT COUNT(*) AS n FROM share_unlock_log WHERE note_id = $1`, [v.noteId]
        );
        const viewNumber = Number(rows[0]?.n ?? 1);
        v.geo = (await lookupIp(v.ip)) ?? undefined;
        if (await sendEmail(v, viewNumber)) {
            await execute(
                `UPDATE share_unlock_log SET emailed = true WHERE id = (
                     SELECT id FROM share_unlock_log WHERE note_id = $1 ORDER BY created_at DESC LIMIT 1)`,
                [v.noteId]
            );
        } else {
            await postAlertNote(v, viewNumber);
        }
    } catch (e) {
        console.error("[share-alert] failed", e);
    }
}
