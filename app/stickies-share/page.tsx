"use client";

import { useEffect, useRef, useState } from "react";
import { marked } from "marked";

interface SharedNote {
    title: string;
    content: string;
    color: string;
    folder_name: string;
}

type State = "loading" | "ready" | "burned" | "error";

function seeded(i: number, salt: number): number {
    return (Math.abs(Math.sin(i * 127.1 + salt * 311.7) * 43758.5453) % 1);
}

const FLAME_COLORS = ["#FF6B00", "#FF9500", "#FFCC00", "#FF3B30", "#FF6B4E", "#FF4500"];
const CONFETTI_COLORS = ["#FF3B30","#FF9500","#FFCC00","#34C759","#007AFF","#AF52DE","#FF2D55","#00C7BE","#FF6B4E","#5856D6"];
const CONFETTI = Array.from({ length: 80 }, (_, i) => ({
    id: i,
    x: seeded(i, 10) * 100,
    delay: seeded(i, 11) * 0.8,
    dur: 1.8 + seeded(i, 12) * 1.4,
    size: 6 + seeded(i, 13) * 10,
    dx: (seeded(i, 14) - 0.5) * 300,
    rotation: seeded(i, 15) * 720,
    color: CONFETTI_COLORS[Math.floor(seeded(i, 16) * CONFETTI_COLORS.length)],
    isRect: seeded(i, 17) > 0.5,
}));

const PARTICLES = Array.from({ length: 70 }, (_, i) => {
    const isSmoke = i >= 55;
    return {
        id: i,
        x: seeded(i, 0) * 100,
        delay: seeded(i, 1) * 1.8,
        dur: 0.7 + seeded(i, 2) * 2.0,
        size: isSmoke ? 20 + seeded(i, 3) * 40 : 10 + seeded(i, 3) * 38,
        dx: (seeded(i, 4) - 0.5) * 160,
        color: isSmoke
            ? `rgba(${60 + Math.floor(seeded(i, 6) * 40)},${60 + Math.floor(seeded(i, 7) * 30)},${60 + Math.floor(seeded(i, 8) * 30)},0.45)`
            : FLAME_COLORS[Math.floor(seeded(i, 6) * FLAME_COLORS.length)],
        blur: isSmoke ? 8 + seeded(i, 7) * 12 : 1 + seeded(i, 7) * 4,
        isSmoke,
    };
});

export default function StickiesShare() {
    const [note, setNote] = useState<SharedNote | null>(null);
    const [state, setState] = useState<State>("loading");
    const [copied, setCopied] = useState(false);
    const [fireBurning, setFireBurning] = useState(false);
    const [isBurnLink, setIsBurnLink] = useState(false);
    const [burnToken, setBurnToken] = useState<string | null>(null);
    const [hasBurned, setHasBurned] = useState(false);
    const [fadingOut, setFadingOut] = useState(false);
    const [showBurnAlert, setShowBurnAlert] = useState(true);
    const copyBtnRef = useRef<HTMLButtonElement>(null);
    const fireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const token = params.get("token");
        if (token) {
            setIsBurnLink(true);
            setBurnToken(token);
            // Track visitor
            fetch("/api/v", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    path: "/stickies-share",
                    referrer: document.referrer || "qr-scan",
                    screen_width: window.screen.width,
                    screen_height: window.screen.height,
                }),
            }).catch(() => {});
            fetch(`/api/stickies/share?token=${encodeURIComponent(token)}`)
                .then(async (res) => {
                    if (res.status === 410) { setState("burned"); return; }
                    if (!res.ok) { setState("error"); return; }
                    const data = await res.json();
                    setNote(data);
                    setState("ready");
                })
                .catch(() => setState("error"));
            return;
        }
        try {
            const data = params.get("data");
            if (!data) { setState("error"); return; }
            const decoded: SharedNote = JSON.parse(decodeURIComponent(escape(atob(data))));
            if (!decoded?.title && !decoded?.content) { setState("error"); return; }
            setNote(decoded);
            setState("ready");
        } catch {
            setState("error");
        }
    }, []);

    useEffect(() => {
        if (state === "ready") setTimeout(() => copyBtnRef.current?.focus(), 100);
    }, [state]);

    useEffect(() => {
        if (state === "ready" && isBurnLink) {
            const t = setTimeout(() => setShowBurnAlert(false), 5000);
            return () => clearTimeout(t);
        }
    }, [state, isBurnLink]);

    const handleCopy = async () => {
        if (!note || hasBurned) return;
        try {
            await navigator.clipboard.writeText(note.content);
        } catch {
            const ta = document.createElement("textarea");
            ta.value = note.content;
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
        if (isBurnLink && burnToken) {
            // Burn AFTER copy — not on page load, so pre-fetchers don't consume the token
            fetch(`/api/stickies/share?token=${encodeURIComponent(burnToken)}`, { method: "DELETE" }).catch(() => {});
            setHasBurned(true);
            if (fireTimerRef.current) clearTimeout(fireTimerRef.current);
            setFireBurning(true);
            fireTimerRef.current = setTimeout(() => {
                setFireBurning(false);
                setFadingOut(true);
                setTimeout(() => setState("burned"), 2000);
            }, 3800);
        }
    };

    if (state === "loading") return <div className="min-h-screen bg-black" />;

    if (state === "burned") {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-3 px-6">
                <div className="text-5xl mb-2">🔥</div>
                <p className="text-white font-black uppercase tracking-widest text-sm">This note has been destroyed.</p>
                <p className="text-zinc-600 text-xs uppercase tracking-wide text-center">Burn-after-read links can only be opened once.</p>
            </div>
        );
    }

    if (state === "error" || !note) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <p className="text-zinc-500 text-sm font-black uppercase tracking-wider">Invalid or expired link.</p>
            </div>
        );
    }

    const isMarkdown = /^#+\s|^\*\*|^-\s|\n#{1,6}\s/m.test(note.content ?? "");
    const html = isMarkdown ? marked.parse(note.content ?? "") as string : null;
    // Preview: first 300 chars, stripped of markdown syntax
    const previewText = (note.content ?? "").replace(/^#+\s/gm, "").replace(/\*\*/g, "").replace(/`/g, "").slice(0, 320);

    return (
        <div
            className="min-h-screen bg-black text-white flex flex-col overflow-hidden relative"
            style={{ transition: "opacity 2s ease-in-out", opacity: fadingOut ? 0 : 1 }}
        >
            <style>{`
                @keyframes emberRise {
                    0%   { transform: translateY(0) translateX(0) scaleX(1) scaleY(1); opacity: 0; }
                    6%   { opacity: 1; }
                    50%  { transform: translateY(-50vh) translateX(calc(var(--dx) * 0.5px)) scaleX(0.7) scaleY(1.4); opacity: 0.85; }
                    100% { transform: translateY(-105vh) translateX(calc(var(--dx) * 1px)) scaleX(0.2) scaleY(0.3); opacity: 0; }
                }
                @keyframes smokeRise {
                    0%   { transform: translateY(0) translateX(0) scale(0.4); opacity: 0; }
                    15%  { opacity: 0.5; }
                    100% { transform: translateY(-90vh) translateX(calc(var(--dx) * 1px)) scale(2.5); opacity: 0; }
                }
                @keyframes fireGlow {
                    0%   { opacity: 0.08; }
                    50%  { opacity: 0.22; }
                    100% { opacity: 0.08; }
                }
                @keyframes fireOverlay {
                    0%   { opacity: 0; }
                    4%   { opacity: 1; }
                    75%  { opacity: 1; }
                    100% { opacity: 0; }
                }
                @keyframes fireText {
                    0%   { opacity: 0; transform: scale(0.6); }
                    12%  { opacity: 1; transform: scale(1.08); }
                    22%  { transform: scale(1); }
                    70%  { opacity: 1; }
                    100% { opacity: 0; transform: scale(1.1); }
                }
                @keyframes pageShake {
                    0%,100% { transform: translateX(0); }
                    10% { transform: translateX(-4px) rotate(-0.3deg); }
                    20% { transform: translateX(4px) rotate(0.3deg); }
                    30% { transform: translateX(-3px); }
                    40% { transform: translateX(3px); }
                    50% { transform: translateX(-2px); }
                    60% { transform: translateX(2px); }
                }
                @keyframes heatDistort {
                    0%,100% { filter: blur(0px) brightness(1); }
                    25% { filter: blur(0.6px) brightness(1.08); }
                    75% { filter: blur(0.3px) brightness(1.04); }
                }
                @keyframes burnOut {
                    0%   { opacity: 1; transform: scale(1); filter: blur(0px); }
                    18%  { opacity: 0.6; transform: scale(0.99); filter: blur(1px); }
                    35%  { opacity: 0; transform: scale(0.97); filter: blur(4px); }
                    100% { opacity: 0; transform: scale(0.95); filter: blur(8px); }
                }
                @keyframes burnWarn {
                    0%,100% { opacity: 1; }
                    50% { opacity: 0.65; }
                }
                @keyframes alertFadeOut {
                    0%   { opacity: 1; transform: translateY(0); }
                    80%  { opacity: 1; transform: translateY(0); }
                    100% { opacity: 0; transform: translateY(-8px); }
                }
            `}</style>

            {/* ── BLURRED CONTENT BACKGROUND ── */}
            <div
                aria-hidden="true"
                className="fixed inset-0 pointer-events-none select-none overflow-hidden"
                style={{ zIndex: 0 }}
            >
                {/* The blurred note content wallpaper */}
                <pre
                    className="absolute inset-0 p-8 font-mono text-sm leading-relaxed whitespace-pre-wrap overflow-hidden"
                    style={{
                        color: "#ffffff",
                        opacity: 0.07,
                        filter: "blur(6px)",
                        transform: "scale(1.04)",
                        transformOrigin: "top left",
                        userSelect: "none",
                    }}
                >
                    {note.content}
                </pre>
                {/* Bottom fade so it doesn't compete with the real content */}
                <div className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: "linear-gradient(to top, #000 40%, transparent)" }} />
                <div className="absolute inset-x-0 top-0 h-24" style={{ background: "linear-gradient(to bottom, #000 30%, transparent)" }} />
            </div>

            {/* ── FIRE OVERLAY ── */}
            {fireBurning && (
                <div
                    className="fixed inset-0 pointer-events-none overflow-hidden"
                    style={{ zIndex: 9999, animation: "fireOverlay 3.8s 0.25s ease-in-out forwards", opacity: 0 }}
                >
                    <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 100%, #FF6B00 0%, #FF3B30 30%, transparent 70%)", animation: "fireGlow 0.25s ease-in-out infinite alternate" }} />
                    {PARTICLES.map((p) => (
                        <div
                            key={p.id}
                            style={{
                                position: "absolute", bottom: "-10px", left: `${p.x}%`,
                                width: p.size, height: p.isSmoke ? p.size * 1.2 : p.size * 1.6,
                                borderRadius: p.isSmoke ? "50%" : "50% 50% 35% 35%",
                                backgroundColor: p.color, filter: `blur(${p.blur}px)`,
                                "--dx": p.dx,
                                animation: `${p.isSmoke ? "smokeRise" : "emberRise"} ${p.dur}s ${p.delay}s ease-out infinite`,
                            } as React.CSSProperties}
                        />
                    ))}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4" style={{ animation: "fireText 3.8s ease-in-out forwards" }}>
                        <div style={{ fontSize: "6rem", lineHeight: 1 }}>🔥</div>
                        <p className="font-black uppercase tracking-[0.25em] text-white text-lg" style={{ textShadow: "0 0 30px #FF6B00, 0 0 60px #FF3B30" }}>Copied &amp; Burned</p>
                        <p className="text-orange-400 text-xs font-bold uppercase tracking-widest opacity-80">Paste it before it's gone</p>
                    </div>
                </div>
            )}

            {/* ── FOREGROUND ── */}
            <div
                className="relative flex flex-col items-center justify-center min-h-screen"
                style={{
                    zIndex: 1,
                    ...(fireBurning ? { animation: "burnOut 0.9s ease-in forwards, pageShake 0.4s ease-in-out" } : {}),
                }}
            >
                {/* Burn warning — top, auto-hides after 5s */}
                {isBurnLink && showBurnAlert && (
                    <div
                        className="absolute top-0 inset-x-0 px-5 pt-5"
                        style={{ animation: "alertFadeOut 5s ease-in-out forwards" }}
                    >
                        <div
                            className="px-4 py-2.5 flex items-center gap-2.5"
                            style={{
                                background: "rgba(255,107,0,0.12)",
                                border: "1px solid rgba(255,107,0,0.35)",
                            }}
                        >
                            <span className="text-base flex-shrink-0">🔥</span>
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-wide text-orange-400">One-time link</p>
                                <p className="text-[10px] text-orange-300/60 leading-tight">Expires after first read. Copy it now.</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Circle copy button — centered */}
                <button
                    ref={copyBtnRef}
                    type="button"
                    onClick={handleCopy}
                    disabled={hasBurned}
                    className="flex flex-col items-center justify-center gap-3 transition-all active:scale-95 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
                    style={{
                        width: 180,
                        height: 180,
                        borderRadius: "50%",
                        border: copied ? "2px solid #22c55e" : "2px solid rgba(255,255,255,0.5)",
                    }}
                >
                    {copied ? (
                        <>
                            <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Copied</span>
                        </>
                    ) : (
                        <>
                            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Copy</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
