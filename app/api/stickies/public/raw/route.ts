import { queryOne } from "@/lib/db-driver";
import { NextResponse } from "next/server";
import { verifyLockPassword, signUnlockCookie, verifyUnlockCookie, unlockCookieName } from "@/lib/lock-password";
import { wrapHtmlWithTheme } from "@/lib/html";
import { unlockedSuccessPage, REVEAL_STYLE } from "@/lib/share-pages";
import { notifyShareView, readVisit, isBot } from "@/lib/share-alert";

/** The URL as the visitor saw it (the hub binds 0.0.0.0, so req.url lies about the host). */
function publicUrl(req: Request): string {
    const u = new URL(req.url);
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    if (host) {
        u.port = "";
        u.host = host;
        u.protocol = req.headers.get("x-forwarded-proto") === "https" || host.endsWith(".vercel.app") ? "https:" : u.protocol;
    }
    return u.toString();
}

/**
 * GET /api/stickies/public/raw?noteId=...
 * Returns raw content for public notes. HTML notes render as a webpage
 * (Content-Type: text/html); everything else serves as text/plain.
 *
 * Locked notes that carry a password show a gate first - viewers must POST
 * the right password to receive an unlock cookie before content is served.
 */
// Public links are meant to be fetched cross-origin (curl, fetch+eval from any
// app), so allow any origin. The data is already public; CORS adds no exposure.
const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: Request) {
    const url = new URL(req.url);
    const noteId = url.searchParams.get("noteId");
    const forceText = url.searchParams.get("as") === "text";
    const theme = shareTheme(url);
    const unlocked = url.searchParams.get("unlocked") === "1";
    if (!noteId) return notFound();

    const row = await queryOne<{ title: string; content: string; type: string | null; is_public: boolean; locked: boolean; lock_password_hash: string | null }>(
        `SELECT title, content, type, is_public, locked, lock_password_hash FROM "stickies" WHERE id = $1 AND trashed_at IS NULL`,
        [noteId]
    );

    if (!row || !row.is_public) return notFound();

    // Locked + password set → require valid unlock cookie before content
    if (row.locked && row.lock_password_hash) {
        const cookie = readCookie(req, unlockCookieName(noteId));
        if (!verifyUnlockCookie(noteId, row.lock_password_hash, cookie)) {
            return gatePage(req, noteId, row.title || "Locked note", false, theme);
        }
    }

    // Every real view tells the owner - open links and the first read after a
    // passcode unlock alike. Not awaited; link-preview crawlers are ignored.
    if (!isBot(req.headers.get("user-agent"))) {
        void notifyShareView(readVisit(req.headers, { id: noteId, title: row.title, link: publicUrl(req) }, unlocked ? "unlock" : "view"));
    }
    return contentResponse(req, noteId, row, forceText, theme, unlocked);
}

// In-memory brute-force / DoS throttle for the public passcode gate. Per-lambda on
// Vercel (not a global limiter), but it still caps rapid guessing against any one
// note and protects CPU from a flood: 10 attempts per 5 minutes per client IP.
const gateHits = new Map<string, { n: number; resetAt: number }>();
function gateRateLimited(req: Request): boolean {
    const ip = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "?").split(",")[0].trim();
    const now = Date.now();
    if (gateHits.size > 5000) gateHits.clear(); // cheap unbounded-growth guard
    const e = gateHits.get(ip);
    if (!e || now > e.resetAt) { gateHits.set(ip, { n: 1, resetAt: now + 5 * 60_000 }); return false; }
    e.n += 1;
    return e.n > 10;
}

export async function POST(req: Request) {
    const url = new URL(req.url);
    const noteId = url.searchParams.get("noteId");
    const theme = shareTheme(url);
    if (!noteId) return notFound();

    // Throttle before the DB hit + the CPU-heavy scrypt verify below.
    if (gateRateLimited(req)) {
        return new NextResponse("Too many attempts. Wait a few minutes and try again.", {
            status: 429,
            headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8", "Retry-After": "300" },
        });
    }

    const form = await req.formData().catch(() => null);
    const password = String(form?.get("password") ?? "").trim();

    const row = await queryOne<{ title: string; lock_password_hash: string | null; is_public: boolean; locked: boolean }>(
        `SELECT title, lock_password_hash, is_public, locked FROM "stickies" WHERE id = $1 AND trashed_at IS NULL`,
        [noteId]
    );
    if (!row || !row.is_public) return notFound();
    if (!row.locked || !row.lock_password_hash) {
        // Note was unlocked between gate render and submit - just bounce back to GET
        return NextResponse.redirect(new URL(`/share?noteId=${noteId}`, req.url), 302);
    }

    if (!(await verifyLockPassword(password, row.lock_password_hash))) {
        return gatePage(req, noteId, row.title || "Locked note", true, theme);
    }

    // The alert fires on the content GET that follows (unlocked=1), not here.
    const token = signUnlockCookie(noteId, row.lock_password_hash);
    const target = `/share?noteId=${encodeURIComponent(noteId)}&theme=${theme}&unlocked=1`;
    const res = new NextResponse(unlockedSuccessPage(target, theme === "dark"), {
        status: 200,
        headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
        },
    });
    res.cookies.set(unlockCookieName(noteId), token, {
        httpOnly: true, sameSite: "lax", secure: req.url.startsWith("https://"),
        path: "/", maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return res;
}

// ── helpers ─────────────────────────────────────────────────────────────────

/** Share links carry the theme the owner was looking at (&theme=dark|light). */
function shareTheme(url: URL): "dark" | "light" {
    return url.searchParams.get("theme") === "dark" ? "dark" : "light";
}

function notFound() {
    return new NextResponse("Not found", { status: 404, headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8" } });
}

function readCookie(req: Request, name: string): string | undefined {
    const raw = req.headers.get("cookie") || "";
    for (const part of raw.split(/;\s*/)) {
        const eq = part.indexOf("=");
        if (eq === -1) continue;
        if (part.slice(0, eq) === name) return decodeURIComponent(part.slice(eq + 1));
    }
    return undefined;
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Build the Open Graph / Twitter meta block so shared /raw links render a rich
// preview (note title + generated card image) in iMessage, Slack, etc. No
// description - the note body dumps messy raw text, so title + card only.
function ogMeta(req: Request, noteId: string, title: string): string {
    const origin = new URL(req.url).origin;
    const safeTitle = escapeHtml(title || "Stickies");
    const img = `${origin}/api/stickies/public/og?noteId=${encodeURIComponent(noteId)}`;
    const pageUrl = `${origin}/share?noteId=${encodeURIComponent(noteId)}`;
    return [
        `<meta property="og:type" content="article">`,
        `<meta property="og:site_name" content="Stickies">`,
        `<meta property="og:title" content="${safeTitle}">`,
        `<meta property="og:url" content="${pageUrl}">`,
        `<meta property="og:image" content="${img}">`,
        `<meta property="og:image:width" content="1200">`,
        `<meta property="og:image:height" content="630">`,
        `<meta name="twitter:card" content="summary_large_image">`,
        `<meta name="twitter:title" content="${safeTitle}">`,
        `<meta name="twitter:image" content="${img}">`,
    ].join("");
}

function contentResponse(req: Request, noteId: string, row: { title: string; content: string; type: string | null }, forceText: boolean, theme: "dark" | "light" = "light", unlocked = false) {
    const isHtml = !forceText && row.type === "html";
    const contentType = isHtml ? "text/html; charset=utf-8" : "text/plain; charset=utf-8";
    let body: string;
    if (!isHtml) {
        body = row.content;
    } else {
        // Same wrapper the app's preview iframe uses (theme surface, 67% zoom, no-swing
        // layout guards, scrollbar) so the shared page looks exactly like the sticky.
        // wrapHtmlWithTheme always yields a document with a <head>.
        const doc = wrapHtmlWithTheme(row.content, theme === "dark");
        const head = `<meta name="viewport" content="width=device-width,initial-scale=1">`
            + (/<title[\s>]/i.test(doc) ? "" : `<title>${escapeHtml(row.title || "Stickies")}</title>`)
            + ogMeta(req, noteId, row.title)
            + (unlocked ? REVEAL_STYLE : "");
        body = doc.replace(/<head([^>]*)>/i, `<head$1>${head}`);
    }

    const headers: Record<string, string> = {
        ...CORS,
        "Content-Type": contentType,
        "X-Note-Title": encodeURIComponent(row.title),
        "Cache-Control": "private, max-age=0, no-store",
    };
    if (isHtml) {
        // Public HTML notes may contain script by design. Sandbox them to an OPAQUE
        // origin (no allow-same-origin): scripts still run, but can't read the owner's
        // cookies or make credentialed calls to /api/stickies if the owner opens the link.
        headers["Content-Security-Policy"] = "sandbox allow-scripts allow-popups";
    }
    return new NextResponse(body, { status: 200, headers });
}

function gatePage(req: Request, noteId: string, title: string, badPassword: boolean, theme: "dark" | "light" = "light") {
    const safeTitle = escapeHtml(title);
    // Liquid glass lock, same look as the Flows gate (flows/lib/passcode-pages.js).
    // The stickies row has no tiny PNG preview, so the card sits on the gradient wash.
    const errorBlock = badPassword
        ? `<div class="alert" role="alert">Wrong passcode</div>`
        : `<div class="alert hidden">&nbsp;</div>`;
    const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${safeTitle}</title>
${ogMeta(req, noteId, title)}
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:linear-gradient(160deg,#f7f8fb 0%,#eceef5 100%);color:#1c1e21;font-family:Inter,-apple-system,BlinkMacSystemFont,'SF Pro Display',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.room{min-height:100%;display:flex;align-items:center;justify-content:center;padding:32px 16px}
/* liquid glass: the page shows through, a prismatic rim catches the light */
.glass{position:relative;width:max-content;min-width:min(480px,calc(100vw - 32px));max-width:min(760px,calc(100vw - 32px));padding:44px 44px 36px;border-radius:32px;text-align:center;isolation:isolate;
  background:linear-gradient(135deg,rgba(255,255,255,0.62) 0%,rgba(255,255,255,0.34) 55%,rgba(255,255,255,0.5) 100%);
  -webkit-backdrop-filter:blur(28px) saturate(170%);backdrop-filter:blur(28px) saturate(170%);
  box-shadow:0 30px 80px -20px rgba(60,70,120,0.22),0 2px 6px rgba(60,70,120,0.06),inset 0 1px 0 rgba(255,255,255,0.95),inset 0 0 0 1px rgba(255,255,255,0.45)}
.glass::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:1.5px;pointer-events:none;z-index:1;
  background:linear-gradient(135deg,rgba(255,178,150,0.9) 0%,rgba(255,230,210,0.35) 18%,rgba(255,255,255,0.5) 45%,rgba(190,170,255,0.3) 70%,rgba(140,190,255,0.85) 100%);
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude}
.glass::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:-1;
  background:radial-gradient(42% 32% at 4% 6%,rgba(255,190,170,0.3) 0%,rgba(255,190,170,0) 70%),radial-gradient(40% 32% at 97% 96%,rgba(170,150,255,0.3) 0%,rgba(170,150,255,0) 70%),radial-gradient(30% 25% at 96% 6%,rgba(150,215,255,0.18) 0%,rgba(150,215,255,0) 70%)}
.logo{display:block;margin:0 auto 20px;width:76px;height:76px;border-radius:20px;box-shadow:0 10px 26px rgba(28,30,33,0.3),inset 0 0 0 1px rgba(255,255,255,0.3)}
.caption{font-size:14px;color:#6b7280;margin-top:8px;line-height:1.5}
.name{font-size:28px;line-height:1.2;font-weight:800;letter-spacing:-0.03em;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.alert{margin:18px 0 -6px;font-size:13.5px;font-weight:600;color:#d92d20;animation:shake 0.4s ease-in-out}
@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
.alert.hidden{visibility:hidden;animation:none}
.entry{margin-top:30px;display:flex;align-items:center;gap:10px;padding:6px 6px 6px 20px;border-radius:999px;
  background:rgba(255,255,255,0.55);border:1px solid rgba(255,255,255,0.9);
  box-shadow:inset 0 1px 1px rgba(255,255,255,0.9),0 12px 34px -8px rgba(110,100,200,0.22),0 0 0 1px rgba(120,110,200,0.08);transition:box-shadow .15s}
.entry:focus-within{box-shadow:inset 0 1px 1px rgba(255,255,255,0.9),0 12px 34px -8px rgba(110,100,200,0.3),0 0 0 4px rgba(129,140,248,0.28)}
.entry svg.lock{flex:none;width:22px;height:22px;color:#6b7280}
/* type=text + text-security masks input WITHOUT being a password field, so
   LastPass/1Password never attach their autofill icon. */
.entry input{flex:1;min-width:0;background:transparent;border:0;outline:0;color:#1f2937;font-size:18px;font-weight:600;font-family:inherit;letter-spacing:0.18em;padding:12px 0;-webkit-text-security:disc;text-security:disc}
.entry input::placeholder{color:#8b93a5;font-weight:400;letter-spacing:0.01em}
.go{flex:none;width:48px;height:48px;border:0;border-radius:50%;cursor:pointer;display:grid;place-items:center;color:#fff;
  background:linear-gradient(145deg,#a5a8ff 0%,#8f8bf4 100%);box-shadow:0 8px 18px -6px rgba(110,100,230,0.6),inset 0 1px 0 rgba(255,255,255,0.5);transition:transform .12s,box-shadow .12s}
.go:hover{transform:translateY(-1px);box-shadow:0 10px 22px -6px rgba(110,100,230,0.7),inset 0 1px 0 rgba(255,255,255,0.5)}
.go:active{transform:translateY(0) scale(0.97)}
.go:focus-visible{outline:3px solid rgba(129,140,248,0.6);outline-offset:2px}
.go svg{width:20px;height:20px}
@media (prefers-reduced-motion:reduce){.alert,.go{animation:none;transition:none}}
</style>
</head><body>
<div class="room">
<form class="glass" method="POST" action="/share?noteId=${encodeURIComponent(noteId)}&theme=${theme}">
  <img class="logo" src="/icon.png" alt="Stickies" width="76" height="76">
  <div class="name">${safeTitle}</div>
  <div class="caption">Protected note</div>
  ${errorBlock}

  <div class="entry">
    <svg class="lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/></svg>
    <input name="password" type="text" autofocus autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore data-bwignore data-form-type="other" required placeholder="Passcode" aria-label="Passcode">
    <button class="go" type="submit" aria-label="Open note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
  </div>
</form>
</div>
</body></html>`;
    return new NextResponse(html, {
        status: badPassword ? 401 : 200,
        headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
        },
    });
}
