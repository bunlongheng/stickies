import { queryOne } from "@/lib/db-driver";
import { NextResponse } from "next/server";
import { verifyLockPassword, signUnlockCookie, verifyUnlockCookie, unlockCookieName } from "@/lib/lock-password";
import { wrapHtmlWithTheme } from "@/lib/html";
import { unlockedSuccessPage, REVEAL_STYLE } from "@/lib/share-pages";
import { notifyShareView, readVisit, isBot } from "@/lib/share-alert";
import { htmlToPlainLines } from "@/lib/note-format";

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

    const row = await queryOne<{ title: string; content: string; type: string | null; is_public: boolean; locked: boolean; lock_password_hash: string | null; folder_color: string | null }>(
        `SELECT title, content, type, is_public, locked, lock_password_hash, folder_color FROM "stickies" WHERE id = $1 AND trashed_at IS NULL`,
        [noteId]
    );

    if (!row || !row.is_public) return notFound();

    // Locked + password set → require valid unlock cookie before content
    if (row.locked && row.lock_password_hash) {
        const cookie = readCookie(req, unlockCookieName(noteId));
        if (!verifyUnlockCookie(noteId, row.lock_password_hash, cookie)) {
            return gatePage(req, noteId, row.title || "Locked note", false, theme, lockBackdrop(row.content, row.folder_color));
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

    const row = await queryOne<{ title: string; lock_password_hash: string | null; is_public: boolean; locked: boolean; content: string; folder_color: string | null }>(
        `SELECT title, lock_password_hash, is_public, locked, content, folder_color FROM "stickies" WHERE id = $1 AND trashed_at IS NULL`,
        [noteId]
    );
    if (!row || !row.is_public) return notFound();
    if (!row.locked || !row.lock_password_hash) {
        // Note was unlocked between gate render and submit - just bounce back to GET
        return NextResponse.redirect(new URL(`/share?noteId=${noteId}`, req.url), 302);
    }

    if (!(await verifyLockPassword(password, row.lock_password_hash))) {
        return gatePage(req, noteId, row.title || "Locked note", true, theme, lockBackdrop(row.content, row.folder_color));
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

// The shape of the locked note, with none of its words: each non-empty line
// becomes a bar as long as the line, on a sheet tinted by the folder colour. It
// sits behind the gate blurred, so the glass has real content to diffuse without
// a single character of the note reaching the browser.
function lockBackdrop(content: string | null, folderColor: string | null): string | null {
    const lines = htmlToPlainLines(content || "").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 34);
    if (!lines.length) return null;
    const accent = folderColor && /^#[0-9a-f]{6}$/i.test(folderColor) ? folderColor : "#c7cbe3";
    const W = 1280, H = 800, left = 300, inner = 680, top = 72, step = 22;
    const bars = lines.map((line, i) => {
        const w = Math.max(60, Math.min(inner, Math.round((line.length / 72) * inner)));
        const heading = i === 0 || (line.length < 28 && !/[.,;:]$/.test(line));
        const h = heading ? 14 : 8;
        return `<rect x="${left}" y="${top + i * step}" width="${w}" height="${h}" rx="4" fill="${heading ? "#2b2f45" : "#6b7390"}"/>`;
    }).join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#f4f5fa"/><rect x="${left - 60}" y="0" width="${inner + 120}" height="${H}" fill="#ffffff"/><rect x="${left - 60}" y="0" width="${inner + 120}" height="26" fill="${accent}"/>${bars}</svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function gatePage(req: Request, noteId: string, title: string, badPassword: boolean, theme: "dark" | "light" = "light", backdrop: string | null = null) {
    const safeTitle = escapeHtml(title);
    // Liquid glass lock: an optical glass card (iridescent rim, edge flares, glass
    // field) on a softly lit room. The stickies row has no preview PNG to blur behind it.
    const errorBlock = badPassword
        ? `<div class="alert" role="alert">Wrong passcode</div>`
        : `<div class="alert hidden">&nbsp;</div>`;
    const html = `<!DOCTYPE html><html lang="en"${backdrop ? ` class="has-blur"` : ""}><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${safeTitle}</title>
${ogMeta(req, noteId, title)}
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;color:#0f172a;font-family:Inter,-apple-system,BlinkMacSystemFont,'SF Pro Display',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
/* the lit room the glass refracts: 3 soft lights on a pale ground, no filters */
body{background:
  radial-gradient(55% 60% at 8% 4%,rgba(255,200,182,0.34) 0%,rgba(255,200,182,0) 75%),
  radial-gradient(50% 58% at 94% 94%,rgba(186,170,255,0.3) 0%,rgba(186,170,255,0) 75%),
  radial-gradient(42% 48% at 90% 6%,rgba(176,222,255,0.26) 0%,rgba(176,222,255,0) 75%),
  radial-gradient(36% 42% at 6% 96%,rgba(176,236,244,0.22) 0%,rgba(176,236,244,0) 75%),
  linear-gradient(160deg,#f6f7fb 0%,#eceef6 100%)}
.room{min-height:100%;display:flex;align-items:center;justify-content:center;padding:32px 16px}
/* ── liquid glass ──────────────────────────────────────────────────────── */
.glass{position:relative;width:100%;max-width:440px;padding:40px;border-radius:36px;text-align:center;isolation:isolate;
  /* 1 white base, 2 diagonal reflection, 3 pearl core, 4 perimeter colour */
  background:
    linear-gradient(118deg,rgba(255,255,255,0) 30%,rgba(255,255,255,0.55) 46%,rgba(255,255,255,0.14) 54%,rgba(255,255,255,0) 68%),
    radial-gradient(90% 70% at 50% 40%,rgba(255,255,255,0.42) 0%,rgba(255,255,255,0) 100%),
    radial-gradient(60% 40% at 0% 0%,rgba(255,205,190,0.22) 0%,rgba(255,205,190,0) 70%),
    radial-gradient(60% 40% at 100% 100%,rgba(190,175,255,0.24) 0%,rgba(190,175,255,0) 70%),
    radial-gradient(45% 35% at 0% 100%,rgba(160,228,245,0.16) 0%,rgba(160,228,245,0) 70%),
    linear-gradient(135deg,rgba(255,255,255,0.58) 0%,rgba(255,255,255,0.3) 50%,rgba(255,255,255,0.46) 100%);
  -webkit-backdrop-filter:blur(40px) saturate(180%);backdrop-filter:blur(40px) saturate(180%);
  /* glass thickness: a crisp white top lip, a violet lower lip, ambient shadow */
  box-shadow:
    inset 0 1.5px 0 rgba(255,255,255,0.95),
    inset 1px 0 0 rgba(255,255,255,0.55),
    inset 0 -1.5px 0 rgba(160,140,230,0.28),
    inset -1px 0 0 rgba(170,160,235,0.16),
    inset 0 0 0 1px rgba(255,255,255,0.35),
    inset 0 22px 36px -24px rgba(255,255,255,0.9),
    inset 0 -30px 40px -36px rgba(150,135,230,0.2),
    0 2px 4px rgba(50,55,100,0.05),
    0 24px 60px -18px rgba(70,70,130,0.26),
    0 60px 100px -40px rgba(120,110,200,0.22);
  animation:rise 450ms cubic-bezier(.2,.8,.2,1) both}
.glass>*{position:relative;z-index:1}
/* iridescent bubble rim: a conic sweep masked to a 1.5px ring */
.glass::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:1.5px;pointer-events:none;z-index:2;
  background:conic-gradient(from 210deg at 50% 50%,
    rgba(255,255,255,0.95) 0deg,
    rgba(255,205,200,0.85) 28deg,
    rgba(255,215,190,0.7) 50deg,
    rgba(255,255,255,0.9) 82deg,
    rgba(185,225,255,0.75) 118deg,
    rgba(170,235,245,0.6) 150deg,
    rgba(255,255,255,0.55) 185deg,
    rgba(200,185,255,0.8) 225deg,
    rgba(215,195,255,0.7) 262deg,
    rgba(255,220,235,0.7) 300deg,
    rgba(255,255,255,0.95) 360deg);
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude}
/* lens flares, embedded in the glass and held to the edges */
.glass::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:0;overflow:hidden;
  background:
    radial-gradient(6px 6px at 9% 7%,rgba(255,255,255,1) 0%,rgba(255,255,255,0.9) 40%,rgba(255,255,255,0) 100%),
    radial-gradient(22% 14% at 6% 5%,rgba(255,200,185,0.55) 0%,rgba(255,200,185,0) 100%),
    linear-gradient(125deg,rgba(255,255,255,0) 4%,rgba(255,255,255,0.75) 9%,rgba(255,255,255,0) 15%),
    radial-gradient(18% 10% at 94% 4%,rgba(255,255,255,0.6) 0%,rgba(255,255,255,0) 100%),
    radial-gradient(20% 14% at 4% 96%,rgba(165,230,245,0.45) 0%,rgba(165,230,245,0) 100%),
    radial-gradient(26% 18% at 96% 97%,rgba(185,165,255,0.5) 0%,rgba(185,165,255,0) 100%),
    radial-gradient(60% 9% at 88% 100%,rgba(255,255,255,0.55) 0%,rgba(255,255,255,0) 100%)}
@keyframes rise{from{opacity:0;transform:translateY(8px) scale(0.97)}to{opacity:1;transform:none}}
/* no backdrop-filter (older Firefox): a milkier base so text still sits on something */
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){
  .glass{background:linear-gradient(135deg,rgba(255,255,255,0.92) 0%,rgba(255,255,255,0.84) 100%)}
  .entry{background:rgba(255,255,255,0.9)}}
/* ── content ───────────────────────────────────────────────────────────── */
.logo{display:block;margin:0 auto 18px;width:76px;height:76px;border-radius:20px;box-shadow:0 10px 26px rgba(28,30,33,0.28),inset 0 0 0 1px rgba(255,255,255,0.3)}
.name{font-size:22px;line-height:1.2;font-weight:700;letter-spacing:-0.03em;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.caption{font-size:13.5px;color:#6b7280;margin-top:6px;line-height:1.5}
.alert{margin:16px 0 -8px;font-size:13.5px;font-weight:600;color:#d92d20;animation:shake 0.4s ease-in-out}
@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
.alert.hidden{visibility:hidden;animation:none}
/* the field is a smaller slab of the same glass, set into the card */
.entry{margin-top:28px;height:64px;display:flex;align-items:center;gap:10px;padding:0 10px 0 18px;border-radius:20px;
  background:linear-gradient(180deg,rgba(255,255,255,0.7) 0%,rgba(255,255,255,0.42) 100%);
  -webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);
  border:1px solid rgba(255,255,255,0.85);
  box-shadow:inset 0 1.5px 0 rgba(255,255,255,1),inset 0 -1px 0 rgba(150,140,220,0.18),inset 0 8px 14px -10px rgba(90,90,150,0.18),0 1px 2px rgba(255,255,255,0.6),0 10px 24px -14px rgba(90,80,170,0.28);
  transition:box-shadow .15s}
.entry:focus-within{box-shadow:inset 0 1.5px 0 rgba(255,255,255,1),inset 0 -1px 0 rgba(150,140,220,0.18),inset 0 8px 14px -10px rgba(90,90,150,0.18),0 10px 24px -14px rgba(90,80,170,0.3),0 0 0 4px rgba(129,140,248,0.28)}
.entry svg.lock{flex:none;width:22px;height:22px;color:#6b7280}
/* type=text + text-security masks input WITHOUT being a password field, so
   LastPass/1Password never attach their autofill icon. */
.entry input{flex:1;min-width:0;background:transparent;border:0;outline:0;color:#1f2937;font-size:17px;font-weight:600;font-family:inherit;letter-spacing:0.18em;padding:12px 0;-webkit-text-security:disc;text-security:disc}
.entry input::placeholder{color:#8b93a5;font-weight:400;letter-spacing:0.01em}
/* the submit is a small lavender bubble */
.go{position:relative;flex:none;width:44px;height:44px;border:1px solid rgba(255,255,255,0.55);border-radius:50%;cursor:pointer;display:grid;place-items:center;color:#fff;overflow:hidden;
  background:linear-gradient(150deg,#b7b4ff 0%,#9a93f6 55%,#8a80ee 100%);
  box-shadow:inset 0 1px 0 rgba(255,255,255,0.7),inset 0 -6px 10px -6px rgba(90,70,200,0.5),0 8px 18px -6px rgba(110,100,230,0.6);transition:transform .12s,box-shadow .12s}
.go::before{content:"";position:absolute;left:18%;top:8%;width:62%;height:40%;border-radius:50%;pointer-events:none;
  background:linear-gradient(180deg,rgba(255,255,255,0.75) 0%,rgba(255,255,255,0) 100%)}
.go:hover{transform:translateY(-1px);box-shadow:inset 0 1px 0 rgba(255,255,255,0.7),inset 0 -6px 10px -6px rgba(90,70,200,0.5),0 10px 22px -6px rgba(110,100,230,0.7)}
.go:active{transform:translateY(0) scale(0.97)}
.go:focus-visible{outline:3px solid rgba(129,140,248,0.6);outline-offset:2px}
.go svg{width:18px;height:18px;position:relative}
/* the note's shape behind the gate, softened once here and again through the glass */
.blur{position:fixed;inset:-40px;z-index:0;background:#f4f5fa url("${backdrop || ""}") center/cover no-repeat;filter:blur(9px) saturate(1.05)}
.veil{position:fixed;inset:0;z-index:0;background:
  radial-gradient(55% 60% at 8% 4%,rgba(255,200,182,0.3) 0%,rgba(255,200,182,0) 75%),
  radial-gradient(50% 58% at 94% 94%,rgba(186,170,255,0.28) 0%,rgba(186,170,255,0) 75%),
  rgba(255,255,255,0.32)}
.has-blur .room{position:relative;z-index:1}
@media (prefers-reduced-motion:reduce){.glass,.alert,.go,.entry{animation:none;transition:none}}
</style>
</head><body>
${backdrop ? `<div class="blur" aria-hidden="true"></div><div class="veil" aria-hidden="true"></div>` : ""}
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
