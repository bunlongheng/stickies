// WebAudio UI sound engine - extracted verbatim from app/(app)/page.tsx as part of
// decomposing the page God component. Pure module: a shared AudioContext plus a
// synth playSound(). Every sound is non-critical and self-silencing on error.

export type SoundType =
    | "create" | "delete" | "move" | "add" | "check" | "uncheck"
    | "hover" | "click" | "toast" | "toast-error" | "navigate";

let _lastHoverSoundAt = 0;
let _sharedAudioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext {
    if (!_sharedAudioCtx || _sharedAudioCtx.state === "closed") {
        _sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (_sharedAudioCtx.state === "suspended") _sharedAudioCtx.resume();
    return _sharedAudioCtx;
}

export function playSound(type: SoundType) {
    try {
        if (type === "hover") {
            const now = Date.now();
            if (now - _lastHoverSoundAt < 80) return;
            _lastHoverSoundAt = now;
        }
        const ctx = getAudioCtx();
        const now = ctx.currentTime;
        const MASTER_VOL = 0.5;
        const tone = (freq: number, delay: number, vol: number, dur: number, oscType: OscillatorType = "sine") => {
            const v = vol * MASTER_VOL;
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.connect(g); g.connect(ctx.destination);
            osc.type = oscType;
            osc.frequency.value = freq;
            g.gain.setValueAtTime(0, now + delay);
            g.gain.linearRampToValueAtTime(v, now + delay + 0.012);
            g.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
            osc.start(now + delay); osc.stop(now + delay + dur + 0.02);
        };
        // Cyberpunk / futuristic sound design — sawtooth & square oscillators, high-freq sweeps
        const sweep = (f0: number, f1: number, delay: number, vol: number, dur: number, oscType: OscillatorType = "sawtooth") => {
            const v = vol * MASTER_VOL;
            const osc = ctx.createOscillator(); const g = ctx.createGain();
            osc.connect(g); g.connect(ctx.destination);
            osc.type = oscType;
            osc.frequency.setValueAtTime(f0, now + delay);
            osc.frequency.exponentialRampToValueAtTime(f1, now + delay + dur);
            g.gain.setValueAtTime(0, now + delay);
            g.gain.linearRampToValueAtTime(v, now + delay + 0.008);
            g.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
            osc.start(now + delay); osc.stop(now + delay + dur + 0.02);
        };
        if (type === "hover") {
            // ultra-short digital tick
            tone(2400, 0, 0.018, 0.030, "square");
        } else if (type === "click") {
            // soft digital tap — short rising chime
            tone(880, 0, 0.10, 0.08, "sine");      // A5 base tap
            tone(1320, 0.02, 0.06, 0.10, "sine");   // E6 harmonic shimmer
        } else if (type === "navigate") {
            // system dive: two-step ascending sweep
            sweep(600, 1400, 0,    0.055, 0.09, "sawtooth");
            sweep(900, 2000, 0.07, 0.04,  0.09, "square");
        } else if (type === "toast") {
            // success sequence: rising tri-tone cyber chime
            tone(1047, 0,    0.065, 0.12, "square");  // C6
            tone(1319, 0.08, 0.055, 0.13, "square");  // E6
            tone(1568, 0.16, 0.045, 0.15, "sawtooth"); // G6
        } else if (type === "toast-error") {
            // system alert: descending sawtooth glitch
            sweep(1200, 220, 0,    0.07, 0.18, "sawtooth");
            sweep(900,  180, 0.06, 0.05, 0.15, "square");
        } else if (type === "create") {
            // spawn: ascending digital burst
            sweep(400, 1600, 0,    0.08, 0.12, "sawtooth");
            sweep(600, 2200, 0.05, 0.055, 0.10, "square");
        } else if (type === "add") {
            // quick blip
            sweep(1200, 1800, 0, 0.065, 0.07, "square");
        } else if (type === "check") {
            // confirm: two rising square tones
            tone(1319, 0,    0.07, 0.10, "square"); // E6
            tone(1760, 0.07, 0.06, 0.12, "square"); // A6
        } else if (type === "uncheck") {
            // undo: two descending square tones
            tone(1760, 0,    0.065, 0.10, "square"); // A6
            tone(1047, 0.07, 0.05,  0.12, "square"); // C6
        } else if (type === "delete") {
            // disintegrate: fast saw sweep crunch
            sweep(1800, 80, 0,    0.09, 0.20, "sawtooth");
            sweep(1200, 60, 0.04, 0.06, 0.18, "square");
        } else if (type === "move") {
            // warp: smooth rising saw whoosh
            sweep(300, 1800, 0, 0.055, 0.14, "sawtooth");
            tone(1400, 0.10, 0.03, 0.07, "square");
        }
    } catch { /* silently ignore — sound is non-critical */ }
}
