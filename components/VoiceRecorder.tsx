"use client";
import { useEffect, useRef, useState, useCallback } from "react";

export interface VoiceNoteData {
    _type: "voice";
    audioUrl: string;
    transcript: string;
    summary: string;
    duration: number;
    recordedAt: string;
}

interface RecorderProps {
    noteId: string | null;
    getToken: () => Promise<string>;
    onComplete: (data: VoiceNoteData) => void;
    onCancel: () => void;
}

type Phase = "idle" | "recording" | "processing" | "done" | "error";

function fmt(secs: number): string {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = Math.floor(secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
}

export function VoiceRecorder({ noteId, getToken, onComplete, onCancel }: RecorderProps) {
    const [phase, setPhase] = useState<Phase>("idle");
    const [elapsed, setElapsed] = useState(0);
    const [status, setStatus] = useState("Tap to record");
    const [error, setError] = useState("");

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const rafRef = useRef<number>(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef = useRef(0);

    // ── Waveform animation ───────────────────────────────────────────────────
    const drawWave = useCallback(() => {
        const canvas = canvasRef.current;
        const analyser = analyserRef.current;
        if (!canvas || !analyser) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const buf = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteTimeDomainData(buf);

        const { width: W, height: H } = canvas;
        ctx.clearRect(0, 0, W, H);

        // Glow line
        ctx.beginPath();
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2;
        ctx.shadowBlur = 8;
        ctx.shadowColor = "#ef4444";

        const slice = W / buf.length;
        let x = 0;
        for (let i = 0; i < buf.length; i++) {
            const y = (buf[i] / 128) * (H / 2);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            x += slice;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        rafRef.current = requestAnimationFrame(drawWave);
    }, []);

    // ── Start recording ──────────────────────────────────────────────────────
    const startRecording = useCallback(async () => {
        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error("Microphone requires HTTPS or localhost. Open via localhost:4444 instead.");
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // Audio analyser for waveform
            const audioCtx = new AudioContext();
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 512;
            source.connect(analyser);
            audioCtxRef.current = audioCtx;
            analyserRef.current = analyser;

            // MediaRecorder
            const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
                ? "audio/webm;codecs=opus"
                : MediaRecorder.isTypeSupported("audio/webm")
                ? "audio/webm"
                : "audio/mp4";

            chunksRef.current = [];
            const recorder = new MediaRecorder(stream, { mimeType });
            recorderRef.current = recorder;

            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
            recorder.onstop = handleRecordingStop;
            recorder.start(100);

            startTimeRef.current = Date.now();
            setElapsed(0);
            timerRef.current = setInterval(() => {
                setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
            }, 500);

            setPhase("recording");
            setStatus("Recording…");
            rafRef.current = requestAnimationFrame(drawWave);
        } catch (err: any) {
            setError(err.message ?? "Microphone access denied");
            setPhase("error");
        }
    }, [drawWave]);

    // ── Stop recording ───────────────────────────────────────────────────────
    const stopRecording = useCallback(() => {
        recorderRef.current?.stop();
        streamRef.current?.getTracks().forEach((t) => t.stop());
        cancelAnimationFrame(rafRef.current);
        if (timerRef.current) clearInterval(timerRef.current);
        audioCtxRef.current?.close();
        setPhase("processing");
        setStatus("Transcribing…");
    }, []);

    // ── After MediaRecorder stops — upload + transcribe ──────────────────────
    const handleRecordingStop = useCallback(async () => {
        const mimeType = recorderRef.current?.mimeType ?? "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const durationSecs = Math.round((Date.now() - startTimeRef.current) / 1000);

        const fd = new FormData();
        fd.append("file", blob, `voice.${mimeType.includes("mp4") ? "m4a" : "webm"}`);
        fd.append("noteId", noteId ?? "unsorted");
        fd.append("duration", String(durationSecs));

        try {
            const token = await getToken();
            const res = await fetch("/api/stickies/voice", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: fd,
            });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            setStatus("Done!");
            setPhase("done");

            onComplete({
                _type: "voice",
                audioUrl: data.audioUrl,
                transcript: data.transcript ?? "",
                summary: data.summary ?? "",
                duration: durationSecs,
                recordedAt: new Date().toISOString(),
            });
        } catch (err: any) {
            setError(err.message ?? "Upload failed");
            setPhase("error");
        }
    }, [noteId, getToken, onComplete]);

    // ── Draw flat waveform when idle ──────────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || phase === "recording") return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const { width: W, height: H } = canvas;
        ctx.clearRect(0, 0, W, H);
        ctx.beginPath();
        ctx.strokeStyle = phase === "error" ? "#ef4444" : "rgba(255,255,255,0.12)";
        ctx.lineWidth = 1.5;
        ctx.moveTo(0, H / 2);
        ctx.lineTo(W, H / 2);
        ctx.stroke();
    }, [phase]);

    // ── Cleanup on unmount ────────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            streamRef.current?.getTracks().forEach((t) => t.stop());
            cancelAnimationFrame(rafRef.current);
            if (timerRef.current) clearInterval(timerRef.current);
            audioCtxRef.current?.close().catch(() => {});
        };
    }, []);

    const isRecording = phase === "recording";
    const isProcessing = phase === "processing";
    const isDisabled = isProcessing || phase === "done";

    return (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget && !isRecording && !isProcessing) onCancel(); }}>
            <div className="flex flex-col items-center gap-6 p-8 bg-zinc-950 border border-zinc-800 w-full max-w-sm mx-4"
                style={{ boxShadow: "0 0 60px rgba(239,68,68,0.15)" }}>

                {/* Title */}
                <div className="text-xs font-black uppercase tracking-widest text-zinc-500">Voice Note</div>

                {/* Waveform canvas */}
                <canvas ref={canvasRef} width={280} height={48}
                    className="w-full rounded-none"
                    style={{ background: "transparent" }} />

                {/* Timer */}
                <div className="text-3xl font-black tabular-nums text-white tracking-tight">
                    {fmt(elapsed)}
                </div>

                {/* Status */}
                <div className="text-xs text-zinc-500 uppercase tracking-widest min-h-[1rem]">
                    {phase === "error" ? error : status}
                </div>

                {/* Buttons */}
                <div className="flex items-center gap-4 w-full">
                    <button
                        onClick={onCancel}
                        disabled={isProcessing}
                        className="flex-1 h-11 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 text-xs font-black uppercase tracking-widest transition disabled:opacity-40">
                        Cancel
                    </button>

                    {/* Record / Stop button */}
                    <button
                        onClick={isRecording ? stopRecording : startRecording}
                        disabled={isDisabled}
                        className="w-14 h-14 flex items-center justify-center transition disabled:opacity-40"
                        style={{
                            background: isRecording ? "#ef4444" : "#ffffff",
                            boxShadow: isRecording ? "0 0 24px rgba(239,68,68,0.6)" : "none",
                        }}>
                        {isRecording ? (
                            /* Stop square */
                            <span className="w-4 h-4 bg-white block" />
                        ) : isProcessing ? (
                            /* Spinner */
                            <span className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin block" />
                        ) : (
                            /* Mic circle */
                            <span className="w-5 h-5 rounded-full bg-red-500 block" />
                        )}
                    </button>

                    {/* Placeholder for layout balance */}
                    <div className="flex-1" />
                </div>

                {isRecording && (
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-[10px] text-red-400 uppercase tracking-widest font-bold">Live</span>
                    </div>
                )}
            </div>
        </div>
    );
}
