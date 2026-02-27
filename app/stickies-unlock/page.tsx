"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

const LS_KEY = "stickies_pw";
const LS_FAILS = "stickies_fails";
const MAX = 3;

type Status = "boot" | "idle" | "checking" | "wrong" | "success" | "locked";

// ── Confetti ────────────────────────────────────────────────────────────────
function Confetti() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const cvs = canvas;
        const ctx = cvs.getContext("2d")!;
        cvs.width = window.innerWidth;
        cvs.height = window.innerHeight;

        const colors = ["#22c55e", "#10b981", "#a3e635", "#ffffff", "#86efac", "#4ade80", "#facc15", "#34d399"];
        const particles = Array.from({ length: 120 }, () => ({
            x: Math.random() * cvs.width,
            y: Math.random() * -cvs.height,
            w: Math.random() * 10 + 4,
            h: Math.random() * 5 + 3,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.15,
            vx: (Math.random() - 0.5) * 3,
            vy: Math.random() * 4 + 2,
            alpha: 1,
        }));

        let frame: number;
        let tick = 0;

        function draw() {
            ctx.clearRect(0, 0, cvs.width, cvs.height);
            tick++;
            let alive = false;
            for (const p of particles) {
                p.x += p.vx;
                p.y += p.vy;
                p.rotation += p.rotSpeed;
                if (tick > 80) p.alpha = Math.max(0, p.alpha - 0.012);
                if (p.alpha > 0 && p.y < cvs.height + 20) alive = true;

                ctx.save();
                ctx.globalAlpha = p.alpha;
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                ctx.restore();
            }
            if (alive) frame = requestAnimationFrame(draw);
        }

        frame = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(frame);
    }, []);

    return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-50" />;
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function StickiesUnlockPage() {
    const [pw, setPw] = useState("");
    const [status, setStatus] = useState<Status>("boot");
    const [fails, setFails] = useState(0);
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);

    const tryUnlock = useCallback(async (password: string): Promise<boolean> => {
        const res = await fetch("/api/stickies/unlock", {
            method: "POST",
            body: JSON.stringify({ password }),
            headers: { "Content-Type": "application/json" },
        });
        if (res.ok) {
            localStorage.setItem(LS_KEY, "true");
            localStorage.removeItem(LS_FAILS);
            setStatus("success");
            setTimeout(() => router.push("/tools/stickies"), 2500);
            return true;
        }
        return false;
    }, [router]);

    useEffect(() => {
        const f = parseInt(localStorage.getItem(LS_FAILS) || "0");
        if (f >= MAX) { setStatus("locked"); setFails(f); return; }
        setFails(f);
        // If they're on this page, the cookie is gone — clear stale LS flag
        localStorage.removeItem(LS_KEY);
        setStatus("idle");
    }, []);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        const password = inputRef.current?.value || pw;
        if (status !== "idle" || !password) return;
        setStatus("checking");
        const ok = await tryUnlock(password);
        if (!ok) {
            const next = fails + 1;
            setFails(next);
            localStorage.setItem(LS_FAILS, String(next));
            if (next >= MAX) { setStatus("locked"); return; }
            setStatus("wrong");
            setPw("");
            setTimeout(() => setStatus("idle"), 900);
        }
    }

    const open   = status === "success";
    const locked = status === "locked";
    const wrong  = status === "wrong";
    const boot   = status === "boot";

    return (
        <>
            <style>{`
                @keyframes shake {
                    0%,100%{transform:translateX(0)}
                    15%{transform:translateX(-8px)}
                    30%{transform:translateX(8px)}
                    45%{transform:translateX(-8px)}
                    60%{transform:translateX(8px)}
                    80%{transform:translateX(-4px)}
                }
                @keyframes greenPulse {
                    0%{box-shadow:0 0 0 0 rgba(34,197,94,.6)}
                    70%{box-shadow:0 0 0 32px rgba(34,197,94,0)}
                    100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}
                }
                @keyframes checkDraw {
                    from{stroke-dashoffset:30}
                    to{stroke-dashoffset:0}
                }
                .check-path {
                    stroke-dasharray: 30;
                    stroke-dashoffset: 30;
                    animation: checkDraw 0.4s ease forwards 0.1s;
                }
                .door {
                    transform-origin: left center;
                    transition: transform 1.1s cubic-bezier(0.4,0,0.2,1);
                    transform-style: preserve-3d;
                }
                .door.open {
                    transform: perspective(900px) rotateY(-130deg);
                }
                .bolt-h { transition: width 0.25s ease; }
                .bolt-v { transition: height 0.25s ease; }
            `}</style>

            {open && <Confetti />}

            <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-10 select-none">

                <p className="text-zinc-700 text-[9px] font-mono tracking-[0.4em] uppercase">Stickies Vault</p>

                {/* Safe door */}
                <div style={{ perspective: 900 }}>
                    <div className={`door relative ${open ? "open" : ""}`} style={{ width: 240, height: 240 }}>

                        {/* Outer ring */}
                        <div className="absolute inset-0 rounded-full" style={{
                            background: "radial-gradient(circle at 35% 35%, #3f3f46, #18181b)",
                            border: `8px solid ${locked ? "#7f1d1d" : open ? "#14532d" : "#3f3f46"}`,
                            boxShadow: locked
                                ? "0 0 40px rgba(239,68,68,.25), inset 0 1px 0 rgba(255,255,255,.06)"
                                : open
                                ? "0 0 60px rgba(34,197,94,.5), inset 0 1px 0 rgba(255,255,255,.06)"
                                : "0 0 0 3px #09090b, 0 30px 80px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,.06)",
                            transition: "border-color .5s, box-shadow .5s",
                        }} />

                        {/* Hinge */}
                        <div className="absolute left-0 top-1/2" style={{ transform: "translate(-50%,-50%)", width: 16, height: 60, background: "#27272a", borderRadius: 4, border: "2px solid #3f3f46" }} />

                        {/* Bolts */}
                        <div className="bolt-v absolute left-1/2 -translate-x-1/2" style={{ top: -4, width: 12, height: open ? 0 : 28, background: "#52525b", borderRadius: 3, overflow: "hidden" }} />
                        <div className="bolt-v absolute left-1/2 -translate-x-1/2" style={{ bottom: -4, width: 12, height: open ? 0 : 28, background: "#52525b", borderRadius: 3, overflow: "hidden" }} />
                        <div className="bolt-h absolute top-1/2 -translate-y-1/2" style={{ right: -4, height: 12, width: open ? 0 : 28, background: "#52525b", borderRadius: 3, overflow: "hidden" }} />
                        <div className="bolt-h absolute top-1/2 -translate-y-1/2" style={{ left: -4, height: 12, width: open ? 0 : 28, background: "#52525b", borderRadius: 3, overflow: "hidden" }} />

                        {/* Inner face */}
                        <div className="absolute rounded-full" style={{
                            inset: 20,
                            background: "radial-gradient(circle at 40% 30%, #27272a, #09090b)",
                            border: "3px solid #3f3f46",
                        }} />

                        {/* Center dial */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="rounded-full flex items-center justify-center" style={{
                                width: 72, height: 72,
                                background: "radial-gradient(circle at 35% 35%, #3f3f46, #18181b)",
                                border: `3px solid ${locked ? "#dc2626" : open ? "#22c55e" : "#52525b"}`,
                                boxShadow: open ? "0 0 24px rgba(34,197,94,.6)" : locked ? "0 0 16px rgba(239,68,68,.4)" : "none",
                                animation: open ? "greenPulse 1s ease" : "none",
                                transition: "border-color .4s, box-shadow .4s",
                            }}>
                                {open ? (
                                    <svg viewBox="0 0 24 24" fill="none" className="w-9 h-9">
                                        <path className="check-path" d="M5 12.5l4.5 4.5L19 7" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                ) : locked ? (
                                    <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
                                        <rect x="5" y="11" width="14" height="10" rx="2" stroke="#dc2626" strokeWidth="2"/>
                                        <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="#dc2626" strokeWidth="2" strokeLinecap="round"/>
                                    </svg>
                                ) : (
                                    <div className="rounded-full bg-zinc-700" style={{ width: 10, height: 10 }} />
                                )}
                            </div>
                        </div>

                        {/* Handle */}
                        {!open && (
                            <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2">
                                <div style={{ width: 10, height: 40, background: "#52525b", borderRadius: 5, border: "1px solid #71717a" }} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom */}
                {boot ? null : locked ? (
                    <div className="flex flex-col items-center gap-2">
                        <p className="text-red-600 text-xs font-mono tracking-widest">ACCESS DENIED</p>
                        <p className="text-zinc-700 text-[10px] font-mono">too many failed attempts</p>
                    </div>
                ) : open ? (
                    <p className="text-emerald-400 text-xs font-mono tracking-widest animate-pulse">UNLOCKED</p>
                ) : (
                    <form onSubmit={submit} className="flex flex-col gap-3 items-center"
                        style={{ animation: wrong ? "shake 0.5s ease" : "none" }}>
                        <input
                            ref={inputRef}
                            type="password"
                            value={pw}
                            onChange={(e) => setPw(e.target.value)}
                            onInput={(e) => setPw((e.target as HTMLInputElement).value)}
                            className="bg-zinc-900 text-white border border-zinc-800 rounded-lg px-5 py-3 text-base font-mono outline-none focus:border-zinc-600 transition w-56 text-center"
                            placeholder="••••••••"
                            autoFocus
                            autoComplete="current-password"
                            disabled={status === "checking"}
                        />
                        {wrong && (
                            <p className="text-red-500 text-[10px] font-mono tracking-wide">
                                wrong password · {MAX - fails} left
                            </p>
                        )}
                        <button type="submit" disabled={!pw || status === "checking"}
                            className="text-zinc-600 text-[11px] font-mono hover:text-zinc-300 transition-colors disabled:opacity-20 tracking-widest uppercase">
                            {status === "checking" ? "···" : "Unlock"}
                        </button>
                    </form>
                )}
            </div>
        </>
    );
}
