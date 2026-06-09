import { queryOne } from "@/lib/db-driver";
import { NextResponse } from "next/server";
import { verifyLockPassword, signUnlockCookie, verifyUnlockCookie, unlockCookieName } from "@/lib/lock-password";

/**
 * GET /api/stickies/public/raw?noteId=...
 * Returns raw content for public notes. HTML notes render as a webpage
 * (Content-Type: text/html); everything else serves as text/plain.
 *
 * Locked notes that carry a password show a gate first - viewers must POST
 * the right password to receive an unlock cookie before content is served.
 */
export async function GET(req: Request) {
    const url = new URL(req.url);
    const noteId = url.searchParams.get("noteId");
    const forceText = url.searchParams.get("as") === "text";
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
            return gatePage(req, noteId, row.title || "Locked note", false);
        }
    }

    return contentResponse(req, noteId, row, forceText);
}

export async function POST(req: Request) {
    const url = new URL(req.url);
    const noteId = url.searchParams.get("noteId");
    if (!noteId) return notFound();

    const form = await req.formData().catch(() => null);
    const password = String(form?.get("password") ?? "").trim();

    const row = await queryOne<{ title: string; lock_password_hash: string | null; is_public: boolean; locked: boolean }>(
        `SELECT title, lock_password_hash, is_public, locked FROM "stickies" WHERE id = $1 AND trashed_at IS NULL`,
        [noteId]
    );
    if (!row || !row.is_public) return notFound();
    if (!row.locked || !row.lock_password_hash) {
        // Note was unlocked between gate render and submit - just bounce back to GET
        return NextResponse.redirect(new URL(`/raw?noteId=${noteId}`, req.url), 302);
    }

    if (!verifyLockPassword(password, row.lock_password_hash)) {
        return gatePage(req, noteId, row.title || "Locked note", true);
    }

    const token = signUnlockCookie(noteId, row.lock_password_hash);
    const res = new NextResponse(unlockedSuccessPage(noteId), {
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

function notFound() {
    return new NextResponse("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
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
    const pageUrl = `${origin}/raw?noteId=${encodeURIComponent(noteId)}`;
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

function contentResponse(req: Request, noteId: string, row: { title: string; content: string; type: string | null }, forceText: boolean) {
    const isHtml = !forceText && row.type === "html";
    const contentType = isHtml ? "text/html; charset=utf-8" : "text/plain; charset=utf-8";
    let body: string;
    if (!isHtml) {
        body = row.content;
    } else {
        const meta = ogMeta(req, noteId, row.title);
        const isFullDoc = /<html[\s>]/i.test(row.content) || /^\s*<!DOCTYPE/i.test(row.content);
        if (!isFullDoc) {
            body = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(row.title || "Stickies")}</title>${meta}</head><body>${row.content}</body></html>`;
        } else if (/<head[\s>]/i.test(row.content)) {
            body = row.content.replace(/<head([^>]*)>/i, `<head$1>${meta}`);
        } else {
            // Full doc without a <head> - splice one in right after <html ...>
            body = row.content.replace(/<html([^>]*)>/i, `<html$1><head>${meta}</head>`);
        }
    }

    return new NextResponse(body, {
        status: 200,
        headers: {
            "Content-Type": contentType,
            "X-Note-Title": encodeURIComponent(row.title),
            "Cache-Control": "private, max-age=0, no-store",
        },
    });
}

function unlockedSuccessPage(noteId: string): string {
    const target = `/raw?noteId=${encodeURIComponent(noteId)}`;
    return `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ACCESS GRANTED</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:radial-gradient(circle at 50% 40%,#181818 0%,#000 70%);color:#f4f4f4;font-family:'SF Pro Display',-apple-system,BlinkMacSystemFont,system-ui,sans-serif;overflow:hidden;-webkit-font-smoothing:antialiased}
.scene{position:relative;height:100%;display:flex;align-items:center;justify-content:center}
.vault{position:relative;width:280px;height:280px}
.frame{position:absolute;inset:0;border-radius:50%;
  background:radial-gradient(circle at 35% 30%,#2a2a2a 0%,#0a0a0a 70%,#000 100%);
  box-shadow:inset 0 0 40px rgba(0,0,0,0.9),inset 0 1px 0 rgba(255,255,255,0.06),0 30px 80px -10px rgba(255,255,255,0.08)}
.frame::before{content:"";position:absolute;inset:0;border-radius:50%;pointer-events:none;
  background:repeating-conic-gradient(from 0deg,rgba(255,255,255,0.025) 0deg,rgba(255,255,255,0.025) 1deg,transparent 1deg,transparent 6deg)}
.door{position:absolute;inset:14px;border-radius:50%;
  background:linear-gradient(145deg,#2a2a2a 0%,#0c0c0c 60%,#050505 100%);
  box-shadow:inset 0 4px 12px rgba(255,255,255,0.06),inset 0 -8px 16px rgba(0,0,0,0.7),0 8px 24px rgba(0,0,0,0.6);
  transform-origin:14px 50%;animation:open 1.6s cubic-bezier(0.5,0,0.2,1) 0.3s forwards}
.door::before{content:"";position:absolute;inset:18px;border-radius:50%;border:1.5px dashed rgba(255,255,255,0.08)}
.handle{position:absolute;top:50%;left:50%;width:80px;height:80px;margin:-40px 0 0 -40px;border-radius:50%;
  background:linear-gradient(145deg,#e8e8e8 0%,#7a7a7a 50%,#3a3a3a 100%);
  box-shadow:0 4px 14px rgba(0,0,0,0.7),inset 0 2px 4px rgba(255,255,255,0.45),inset 0 -2px 4px rgba(0,0,0,0.4);
  animation:spin 1.2s ease-in forwards}
.handle::before,.handle::after{content:"";position:absolute;background:#050505;border-radius:3px}
.handle::before{top:50%;left:6px;right:6px;height:6px;margin-top:-3px}
.handle::after{left:50%;top:6px;bottom:6px;width:6px;margin-left:-3px}
.glow{position:absolute;inset:-20px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,0.22),transparent 70%);opacity:0;animation:glow 1.8s ease-out 0.2s forwards;pointer-events:none}
.text{position:absolute;bottom:22%;left:50%;transform:translateX(-50%);text-align:center;opacity:0;animation:fadeUp 0.6s ease-out 1.4s forwards}
.text .tag{display:inline-block;font-size:10px;letter-spacing:0.32em;color:#f4f4f4;font-weight:800;font-family:ui-monospace,monospace;padding:5px 12px;border:1px solid rgba(255,255,255,0.35);border-radius:99px;margin-bottom:12px;text-shadow:0 0 8px rgba(255,255,255,0.4)}
.text h1{font-size:22px;font-weight:800;letter-spacing:-0.02em;color:#fff}
.text p{font-size:11px;color:#7a7a7a;margin-top:5px;letter-spacing:0.2em;text-transform:uppercase;font-family:ui-monospace,monospace}
.spark{position:absolute;width:2px;height:10px;top:50%;left:50%;opacity:0;background:#fff;border-radius:1px;box-shadow:0 0 6px rgba(255,255,255,0.7)}
@keyframes open{0%{transform:rotateY(0deg)}100%{transform:rotateY(-115deg)}}
@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(540deg)}}
@keyframes glow{0%{opacity:0;transform:scale(0.7)}40%{opacity:1;transform:scale(1.05)}100%{opacity:0;transform:scale(1.3)}}
@keyframes fadeUp{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}
@keyframes burst{0%{opacity:1;transform:translate(0,0) rotate(0deg) scale(1)}100%{opacity:0;transform:translate(var(--x),var(--y)) rotate(var(--r)) scale(0.5)}}
</style>
</head><body>
<div class="scene">
  <div class="vault">
    <div class="glow"></div>
    <div class="frame"></div>
    <div class="door"><div class="handle"></div></div>
  </div>
  <div class="text"><span class="tag">ACCESS GRANTED</span><h1>Welcome in.</h1><p>Loading payload</p></div>
</div>
<script>
(function(){
  // Robotic "access granted" — three rising square-wave tones.
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      var ctx = new AC();
      var beep = function(freq, start, dur){
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "square"; o.frequency.value = freq;
        g.gain.setValueAtTime(0, ctx.currentTime + start);
        g.gain.linearRampToValueAtTime(0.08, ctx.currentTime + start + 0.01);
        g.gain.linearRampToValueAtTime(0, ctx.currentTime + start + dur);
        o.connect(g); g.connect(ctx.destination);
        o.start(ctx.currentTime + start); o.stop(ctx.currentTime + start + dur + 0.02);
      };
      beep(523.25, 0.20, 0.10);  // C5
      beep(659.25, 0.32, 0.10);  // E5
      beep(987.77, 0.44, 0.22);  // B5 sustain
    }
  } catch(e){}

  // Monochrome spark burst from the vault center — no rainbow, just white pulses
  var scene = document.querySelector(".scene");
  for (var i = 0; i < 60; i++){
    var c = document.createElement("div");
    c.className = "spark";
    var shade = 220 + Math.floor(Math.random() * 36); // 220 - 255, all white-ish
    c.style.background = "rgb(" + shade + "," + shade + "," + shade + ")";
    var angle = Math.random() * Math.PI * 2;
    var distance = 160 + Math.random() * 240;
    c.style.setProperty("--x", Math.cos(angle) * distance + "px");
    c.style.setProperty("--y", Math.sin(angle) * distance + Math.random() * 160 + "px");
    c.style.setProperty("--r", (Math.random() * 720 - 360) + "deg");
    c.style.animation = "burst " + (0.9 + Math.random() * 0.7) + "s cubic-bezier(0.2,0.7,0.4,1) " + (0.4 + Math.random() * 0.3) + "s forwards";
    scene.appendChild(c);
  }

  setTimeout(function(){ window.location.replace(${JSON.stringify(target)}); }, 2400);
})();
</script>
</body></html>`;
}

function gatePage(req: Request, noteId: string, title: string, badPassword: boolean) {
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
  display:flex;align-items:center;gap:10px;
  background:linear-gradient(180deg,#0a0a0a 0%,#020202 100%);
  border:1px solid #1a1a1a;border-radius:10px;
  padding:6px 6px 6px 14px;
  box-shadow:inset 0 2px 6px rgba(0,0,0,0.9),0 1px 0 rgba(255,255,255,0.03);
}
/* type=text + text-security masks input WITHOUT being a password field, so
   LastPass/1Password never attach their autofill icon. */
.entry input{flex:1;background:transparent;border:0;outline:0;color:#fff;font-size:16px;font-family:ui-monospace,monospace;letter-spacing:0.25em;padding:10px 0;text-shadow:0 0 4px rgba(255,255,255,0.3);-webkit-text-security:disc;text-security:disc}
.entry input::placeholder{color:#3a3a3a;letter-spacing:0.15em;font-size:12px}
.unlock{
  flex-shrink:0;height:40px;padding:0 18px;border:0;border-radius:8px;cursor:pointer;
  font-family:ui-monospace,monospace;font-size:11px;font-weight:800;letter-spacing:0.25em;
  color:#8a8a8a;
  border:1px solid #232323;
  background:linear-gradient(180deg,#1a1a1a 0%,#0a0a0a 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.05),
    inset 0 -1px 0 rgba(0,0,0,0.6),
    0 2px 6px rgba(0,0,0,0.7);
  transition:transform 80ms ease,box-shadow 80ms ease,color 120ms ease;
}
.unlock:hover{color:#f4f4f4;box-shadow:inset 0 1px 0 rgba(255,255,255,0.08),inset 0 -1px 0 rgba(0,0,0,0.6),0 2px 10px rgba(0,0,0,0.85),0 0 16px rgba(255,255,255,0.06)}
.unlock:active{transform:translateY(1px);box-shadow:inset 0 2px 4px rgba(0,0,0,0.6),0 1px 2px rgba(0,0,0,0.8)}
.meta{margin-top:18px;display:flex;align-items:center;justify-content:space-between;font-size:9px;letter-spacing:0.25em;color:#3a3a3a;font-family:ui-monospace,monospace;font-weight:600}
.meta .dot{width:4px;height:4px;border-radius:50%;background:#3a3a3a;display:inline-block;margin:0 8px;vertical-align:middle}
</style>
</head><body>
<div class="room">
<form class="safe" method="POST" action="/raw?noteId=${encodeURIComponent(noteId)}">
  <span class="rivet tl"></span><span class="rivet tr"></span>
  <span class="rivet bl"></span><span class="rivet br"></span>

  <div class="lcd">
    <div class="label">CONTENTS</div>
    <div class="name">${safeTitle}</div>
  </div>

  ${errorBlock}

  <div class="entry">
    <input name="password" type="text" autofocus autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore data-bwignore data-form-type="other" required placeholder="enter passcode">
    <button class="unlock" type="submit">UNLOCK</button>
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
