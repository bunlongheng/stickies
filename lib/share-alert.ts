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
    at: Date;
}

/** First hop of x-forwarded-for is the real client on Vercel; others are proxies. */
export function clientIp(req: Request): string {
    const h = req.headers;
    const raw = h.get("x-vercel-forwarded-for") || h.get("x-forwarded-for") || h.get("x-real-ip") || "";
    return raw.split(",")[0].trim() || "unknown";
}

export function readVisit(req: Request, noteId: string, title: string): ShareVisit {
    const h = req.headers;
    return {
        noteId,
        title: title || "Untitled",
        ip: clientIp(req),
        city: h.get("x-vercel-ip-city") ? decodeURIComponent(h.get("x-vercel-ip-city")!) : null,
        country: h.get("x-vercel-ip-country"),
        userAgent: h.get("user-agent"),
        referer: h.get("referer"),
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
    await execute(
        `INSERT INTO share_unlock_log (note_id, title, ip, city, country, user_agent, referer, emailed)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [v.noteId, v.title, v.ip, v.city, v.country, v.userAgent, v.referer, false]
    );
}

function emailBody(v: ShareVisit, viewNumber: number): string {
    const where = [v.city, v.country].filter(Boolean).join(", ") || "unknown";
    const row = (k: string, val: string) =>
        `<tr><td style="padding:6px 14px 6px 0;color:#71717a;font-size:13px;white-space:nowrap">${k}</td>` +
        `<td style="padding:6px 0;color:#18181b;font-size:14px;font-weight:600">${val}</td></tr>`;
    return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px">
  <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#a1a1aa;font-weight:700">Stickies share</div>
  <h1 style="font-size:20px;line-height:1.3;margin:6px 0 2px;color:#18181b">Someone opened "${escapeHtml(v.title)}"</h1>
  <p style="margin:0 0 18px;color:#71717a;font-size:14px">They entered the passcode. This is view ${viewNumber}.</p>
  <table style="border-collapse:collapse;width:100%;max-width:100%">
    ${row("IP", escapeHtml(v.ip))}
    ${row("Location", escapeHtml(where))}
    ${row("Time", v.at.toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }) + " ET")}
    ${row("Referrer", escapeHtml(v.referer || "direct"))}
  </table>
  <p style="margin:16px 0 0;color:#a1a1aa;font-size:12px;word-break:break-all">${escapeHtml(v.userAgent || "no user agent")}</p>
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
        `INSERT INTO "stickies" (user_id, title, content, folder_name, folder_color, is_folder, type, "order", created_by_key, created_by_machine)
         VALUES ($1, $2, $3, 'Alerts', '#FF3B30', false, 'html', 0, 'share-alert', 'hub')`,
        [
            userId,
            `Opened: ${v.title}`,
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
