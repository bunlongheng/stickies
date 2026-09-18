import { queryOne } from "@/lib/db-driver";
import { NextResponse } from "next/server";
import { verifyLockPassword, signUnlockCookie, verifyUnlockCookie, unlockCookieName } from "@/lib/lock-password";
import { wrapHtmlWithTheme } from "@/lib/html";
import { unlockedSuccessPage, REVEAL_STYLE } from "@/lib/share-pages";

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
    const errorBlock = badPassword
        ? `<div class="alert">ACCESS DENIED</div>`
        : `<div class="alert hidden">&nbsp;</div>`;
    const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SAFE // ${safeTitle}</title>
${ogMeta(req, noteId, title)}
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:radial-gradient(ellipse at 50% 30%,#181818 0%,#000 80%);color:#bdbdbd;font-family:'SF Pro Display',-apple-system,BlinkMacSystemFont,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.room{min-height:100%;display:flex;align-items:center;justify-content:center;padding:32px 20px;perspective:1400px}
.safe{position:relative;width:100%;max-width:420px;padding:38px 30px 34px;border-radius:22px;
  background:linear-gradient(145deg,#1c1c1c 0%,#0e0e0e 35%,#050505 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.07),
    inset 0 -1px 0 rgba(0,0,0,0.7),
    inset 0 0 0 1px rgba(255,255,255,0.025),
    0 1px 0 rgba(255,255,255,0.04),
    0 30px 60px -20px rgba(0,0,0,0.95),
    0 80px 120px -40px rgba(0,0,0,0.8);
  transform:rotateX(2deg);
}
/* brushed metal sheen */
.safe::before{content:"";position:absolute;inset:0;border-radius:22px;pointer-events:none;
  background:repeating-linear-gradient(90deg,rgba(255,255,255,0.014) 0,rgba(255,255,255,0.014) 1px,transparent 1px,transparent 3px);
  mix-blend-mode:overlay;}
.rivet{position:absolute;width:9px;height:9px;border-radius:50%;
  background:radial-gradient(circle at 35% 30%,#3a3a3a 0%,#0c0c0c 70%,#000 100%);
  box-shadow:inset 0 0.5px 1px rgba(255,255,255,0.18),0 1px 2px rgba(0,0,0,0.9);}
.rivet.tl{top:12px;left:12px}.rivet.tr{top:12px;right:12px}
.rivet.bl{bottom:12px;left:12px}.rivet.br{bottom:12px;right:12px}
.bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}
.brand{font-size:9px;letter-spacing:0.32em;color:#555;font-weight:700;font-family:ui-monospace,SFMono-Regular,monospace}
.brand b{color:#bdbdbd}
.status{display:flex;align-items:center;gap:8px;font-size:9px;letter-spacing:0.2em;color:#6c6c6c;font-family:ui-monospace,monospace;font-weight:700}
.led{width:9px;height:9px;border-radius:50%;display:inline-block;background:#fff;
  box-shadow:0 0 6px #fff,0 0 14px rgba(255,255,255,0.5),inset 0 -1px 1px rgba(0,0,0,0.3)}
.led-slow{animation:pulse 1.6s ease-in-out infinite}
.led-fast{animation:pulse 0.45s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
/* LCD display — black + white phosphor */
.lcd{
  background:linear-gradient(180deg,#0a0a0a 0%,#020202 100%);
  border:1px solid #1a1a1a;
  border-radius:8px;
  padding:18px 18px 16px;
  margin-bottom:22px;
  box-shadow:inset 0 2px 8px rgba(0,0,0,0.9),inset 0 0 0 1px rgba(0,0,0,0.4),0 1px 0 rgba(255,255,255,0.04);
  font-family:ui-monospace,'SF Mono',Menlo,monospace;
  position:relative;
}
.lcd::after{content:"";position:absolute;inset:0;border-radius:8px;pointer-events:none;
  background:repeating-linear-gradient(0deg,rgba(0,0,0,0.22) 0,rgba(0,0,0,0.22) 1px,transparent 1px,transparent 2px);}
.lcd .label{font-size:9px;letter-spacing:0.32em;color:#5a5a5a;font-weight:700;margin-bottom:6px}
.lcd .name{font-size:14px;color:#f4f4f4;text-shadow:0 0 8px rgba(255,255,255,0.18);font-weight:600;word-break:break-word;line-height:1.4}
.alert{margin:-6px 0 16px;font-size:10px;letter-spacing:0.3em;color:#fff;font-weight:700;text-align:center;font-family:ui-monospace,monospace;text-shadow:0 0 10px rgba(255,255,255,0.7);animation:flash 0.5s ease-in-out 3}
@keyframes flash{0%,100%{opacity:1}50%{opacity:0.25}}
.alert.hidden{visibility:hidden;animation:none}
.entry{
  display:flex;align-items:center;
  background:linear-gradient(180deg,#0a0a0a 0%,#020202 100%);
  border:1px solid #1a1a1a;border-radius:10px;
  padding:6px 16px;
  box-shadow:inset 0 2px 6px rgba(0,0,0,0.9),0 1px 0 rgba(255,255,255,0.03);
}
/* type=text + text-security masks input WITHOUT being a password field, so
   LastPass/1Password never attach their autofill icon. */
.entry input{flex:1;background:transparent;border:0;outline:0;color:#fff;font-size:16px;font-family:ui-monospace,monospace;letter-spacing:0.25em;padding:10px 0;text-shadow:0 0 4px rgba(255,255,255,0.3);-webkit-text-security:disc;text-security:disc}
.entry input::placeholder{color:#3a3a3a;letter-spacing:0.15em;font-size:12px}
.meta{margin-top:18px;display:flex;align-items:center;justify-content:space-between;font-size:9px;letter-spacing:0.25em;color:#3a3a3a;font-family:ui-monospace,monospace;font-weight:600}
.meta .dot{width:4px;height:4px;border-radius:50%;background:#3a3a3a;display:inline-block;margin:0 8px;vertical-align:middle}
</style>
</head><body>
<div class="room">
<form class="safe" method="POST" action="/share?noteId=${encodeURIComponent(noteId)}&theme=${theme}">
  <span class="rivet tl"></span><span class="rivet tr"></span>
  <span class="rivet bl"></span><span class="rivet br"></span>

  <div class="lcd">
    <div class="label">CONTENTS</div>
    <div class="name">${safeTitle}</div>
  </div>

  ${errorBlock}

  <div class="entry">
    <input name="password" type="text" autofocus autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore data-bwignore data-form-type="other" required placeholder="passcode">
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
