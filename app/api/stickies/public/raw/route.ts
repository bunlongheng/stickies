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
            return gatePage(noteId, row.title || "Locked note", false);
        }
    }

    return contentResponse(row, forceText);
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
        return gatePage(noteId, row.title || "Locked note", true);
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

function contentResponse(row: { title: string; content: string; type: string | null }, forceText: boolean) {
    const isHtml = !forceText && row.type === "html";
    const contentType = isHtml ? "text/html; charset=utf-8" : "text/plain; charset=utf-8";
    const body = isHtml && !/<html[\s>]/i.test(row.content) && !/^\s*<!DOCTYPE/i.test(row.content)
        ? `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(row.title || "Stickies")}</title></head><body>${row.content}</body></html>`
        : row.content;

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
<title>Access granted</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:radial-gradient(circle at 50% 40%,#1a1a2e 0%,#050510 70%);color:#fff;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;overflow:hidden}
.scene{position:relative;height:100%;display:flex;align-items:center;justify-content:center}
.vault{position:relative;width:280px;height:280px}
.frame{position:absolute;inset:0;border-radius:50%;background:linear-gradient(145deg,#2a2a3e,#0a0a1a);box-shadow:inset 0 0 40px rgba(0,0,0,0.8),0 30px 80px -10px rgba(245,158,11,0.4)}
.door{position:absolute;inset:14px;border-radius:50%;background:linear-gradient(145deg,#3a3a52,#1a1a2e);box-shadow:inset 0 4px 12px rgba(255,255,255,0.05),inset 0 -8px 16px rgba(0,0,0,0.5),0 8px 24px rgba(0,0,0,0.4);transform-origin:14px 50%;animation:open 1.6s cubic-bezier(0.5,0,0.2,1) 0.3s forwards}
.door::before{content:"";position:absolute;inset:18px;border-radius:50%;border:2px dashed rgba(255,255,255,0.06)}
.handle{position:absolute;top:50%;left:50%;width:80px;height:80px;margin:-40px 0 0 -40px;border-radius:50%;background:linear-gradient(145deg,#f59e0b,#92660b);box-shadow:0 4px 14px rgba(0,0,0,0.5),inset 0 2px 4px rgba(255,255,255,0.3);animation:spin 1.2s ease-in forwards}
.handle::before,.handle::after{content:"";position:absolute;background:#1a1a2e;border-radius:3px}
.handle::before{top:50%;left:6px;right:6px;height:6px;margin-top:-3px}
.handle::after{left:50%;top:6px;bottom:6px;width:6px;margin-left:-3px}
.glow{position:absolute;inset:-20px;border-radius:50%;background:radial-gradient(circle,#f59e0b66,transparent 70%);opacity:0;animation:glow 1.8s ease-out 0.2s forwards;pointer-events:none}
.text{position:absolute;bottom:24%;left:50%;transform:translateX(-50%);text-align:center;opacity:0;animation:fadeUp 0.6s ease-out 1.4s forwards}
.text .tag{display:inline-block;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:#f59e0b;font-weight:700;padding:4px 12px;border:1px solid #f59e0b66;border-radius:99px;margin-bottom:10px}
.text h1{font-size:22px;font-weight:800;letter-spacing:-0.02em}
.text p{font-size:12px;color:#9ca3af;margin-top:4px}
.confetti{position:absolute;width:8px;height:14px;top:50%;left:50%;opacity:0;border-radius:1px}
@keyframes open{0%{transform:rotateY(0deg)}100%{transform:rotateY(-115deg)}}
@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(540deg)}}
@keyframes glow{0%{opacity:0;transform:scale(0.7)}40%{opacity:1;transform:scale(1.05)}100%{opacity:0;transform:scale(1.3)}}
@keyframes fadeUp{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}
@keyframes burst{0%{opacity:1;transform:translate(0,0) rotate(0deg) scale(1)}100%{opacity:0;transform:translate(var(--x),var(--y)) rotate(var(--r)) scale(0.6)}}
</style>
</head><body>
<div class="scene">
  <div class="vault">
    <div class="glow"></div>
    <div class="frame"></div>
    <div class="door"><div class="handle"></div></div>
  </div>
  <div class="text"><span class="tag">Access granted</span><h1>Welcome in.</h1><p>Loading note...</p></div>
</div>
<script>
(function(){
  // Robotic "access granted" beep — three rising square-wave tones.
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

  // Confetti burst from the vault center
  var colors = ["#f59e0b","#22c55e","#3b82f6","#ec4899","#a855f7","#facc15","#ef4444","#06b6d4"];
  var scene = document.querySelector(".scene");
  for (var i = 0; i < 80; i++){
    var c = document.createElement("div");
    c.className = "confetti";
    c.style.background = colors[i % colors.length];
    var angle = Math.random() * Math.PI * 2;
    var distance = 180 + Math.random() * 260;
    c.style.setProperty("--x", Math.cos(angle) * distance + "px");
    c.style.setProperty("--y", Math.sin(angle) * distance + Math.random() * 200 + "px");
    c.style.setProperty("--r", (Math.random() * 720 - 360) + "deg");
    c.style.animation = "burst " + (1 + Math.random() * 0.8) + "s cubic-bezier(0.2,0.7,0.4,1) " + (0.4 + Math.random() * 0.3) + "s forwards";
    scene.appendChild(c);
  }

  // Redirect to the unlocked content after the show
  setTimeout(function(){ window.location.replace(${JSON.stringify(target)}); }, 2400);
})();
</script>
</body></html>`;
}

function gatePage(noteId: string, title: string, badPassword: boolean) {
    const safeTitle = escapeHtml(title);
    const errorBlock = badPassword
        ? `<p style="color:#f87171;font-size:13px;margin:0 0 12px 0">Wrong password. Try again.</p>`
        : "";
    const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Locked - ${safeTitle}</title>
<style>
*{box-sizing:border-box}
html,body{margin:0;padding:0;height:100%;background:#0a0a0a;color:#e8e8e8;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif}
.wrap{min-height:100%;display:flex;align-items:center;justify-content:center;padding:24px}
.card{width:100%;max-width:380px;background:#161616;border:1px solid #262626;border-radius:16px;padding:32px 28px;box-shadow:0 30px 60px -20px rgba(0,0,0,0.6)}
.icon{width:48px;height:48px;border-radius:50%;background:#f59e0b1a;display:flex;align-items:center;justify-content:center;margin:0 auto 18px;color:#f59e0b}
.icon svg{width:22px;height:22px}
h1{font-size:18px;font-weight:700;margin:0 0 6px 0;text-align:center}
.subtitle{font-size:13px;color:#9ca3af;text-align:center;margin:0 0 22px 0;word-break:break-word}
label{font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;display:block;margin-bottom:6px}
input[type=password]{width:100%;padding:12px 14px;font-size:15px;background:#0a0a0a;color:#fff;border:1px solid #2a2a2a;border-radius:10px;outline:none;font-family:inherit}
input[type=password]:focus{border-color:#f59e0b;box-shadow:0 0 0 3px #f59e0b22}
button{width:100%;margin-top:14px;padding:12px 16px;font-size:14px;font-weight:700;background:#f59e0b;color:#0a0a0a;border:0;border-radius:10px;cursor:pointer;font-family:inherit;letter-spacing:0.02em}
button:hover{background:#fbbf24}
.foot{margin-top:18px;font-size:11px;color:#525252;text-align:center}
</style>
</head><body>
<div class="wrap"><form class="card" method="POST" action="/raw?noteId=${encodeURIComponent(noteId)}">
<div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
<h1>Locked note</h1>
<p class="subtitle">${safeTitle}</p>
${errorBlock}
<label for="pw">Password</label>
<input id="pw" name="password" type="password" autofocus autocomplete="off" required>
<button type="submit">Unlock</button>
<p class="foot">Shared via Stickies</p>
</form></div>
</body></html>`;
    return new NextResponse(html, {
        status: badPassword ? 401 : 200,
        headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
        },
    });
}
