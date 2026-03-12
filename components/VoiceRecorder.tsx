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
    autoStart?: boolean;
}

type Phase = "idle" | "recording" | "processing" | "done" | "error";

function fmt(secs: number): string {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = Math.floor(secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
}

export function VoiceRecorder({ noteId, getToken, onComplete, onCancel, autoStart = false }: RecorderProps) {
    const [phase, setPhase] = useState<Phase>("idle");
    const [elapsed, setElapsed] = useState(0);
    const [status, setStatus] = useState("Tap to record");
    const [error, setError] = useState("");
    const [liveText, setLiveText] = useState("");

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const rafRef = useRef<number>(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef = useRef(0);
    const recognitionRef = useRef<any>(null);
    const liveTextRef = useRef("");

    // ── Frequency bar waveform ────────────────────────────────────────────────
    const drawWave = useCallback(() => {
        const canvas = canvasRef.current;
        const analyser = analyserRef.current;
        if (!canvas || !analyser) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const W = canvas.width;
        const H = canvas.height;

        const buf = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(buf);

        ctx.clearRect(0, 0, W, H);

        const barCount = 48;
        const step = Math.floor(buf.length / barCount);
        const barW = W / barCount;
        const gap = 2;

        for (let i = 0; i < barCount; i++) {
            // average a slice of frequency bins
            let sum = 0;
            for (let j = 0; j < step; j++) sum += buf[i * step + j];
            const avg = sum / step;
            const barH = Math.max(2, (avg / 255) * H * 1.4);
            const x = i * barW;
            const y = (H - barH) / 2;

            // gradient: red → orange based on height
            const intensity = avg / 255;
            const r = 239;
            const g = Math.floor(68 + intensity * 100);
            const b = 68;

            ctx.fillStyle = `rgba(${r},${g},${b},${0.5 + intensity * 0.5})`;
            ctx.shadowBlur = intensity * 12;
            ctx.shadowColor = `rgb(${r},${g},${b})`;
            ctx.fillRect(x + gap / 2, y, barW - gap, barH);
        }
        ctx.shadowBlur = 0;

        rafRef.current = requestAnimationFrame(drawWave);
    }, []);

    // ── Start recording ───────────────────────────────────────────────────────
    const startRecording = useCallback(async () => {
        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error("Microphone requires HTTPS or localhost.");
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const audioCtx = new AudioContext();
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            audioCtxRef.current = audioCtx;
            analyserRef.current = analyser;

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

            // ── Live transcript via Web Speech API ────────────────────────────
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                const rec = new SpeechRecognition();
                rec.continuous = true;
                rec.interimResults = true;
                rec.lang = "en-US";
                let finalText = "";
                rec.onresult = (e: any) => {
                    let interim = "";
                    for (let i = e.resultIndex; i < e.results.length; i++) {
                        const t = e.results[i][0].transcript;
                        if (e.results[i].isFinal) finalText += t + " ";
                        else interim = t;
                    }
                    liveTextRef.current = finalText + interim;
                    setLiveText(finalText + interim);
                };
                rec.onerror = () => {};
                rec.start();
                recognitionRef.current = rec;
            }

            setPhase("recording");
            setStatus("Recording…");
            rafRef.current = requestAnimationFrame(drawWave);
        } catch (err: any) {
            setError(err.message ?? "Microphone access denied");
            setPhase("error");
        }
    }, [drawWave]);

    // ── Stop recording ────────────────────────────────────────────────────────
    const stopRecording = useCallback(() => {
        recorderRef.current?.stop();
        streamRef.current?.getTracks().forEach((t) => t.stop());
        cancelAnimationFrame(rafRef.current);
        if (timerRef.current) clearInterval(timerRef.current);
        audioCtxRef.current?.close();
        // Give speech recognition a moment to fire its final result before stopping
        setTimeout(() => recognitionRef.current?.stop(), 400);
        setPhase("processing");
        setStatus("Transcribing…");
    }, []);

    // ── After MediaRecorder stops — upload + transcribe ───────────────────────
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
                transcript: liveTextRef.current || data.transcript || "",
                summary: data.summary ?? "",
                duration: durationSecs,
                recordedAt: new Date().toISOString(),
            });
        } catch (err: any) {
            setError(err.message ?? "Upload failed");
            setPhase("error");
        }
    }, [noteId, getToken, onComplete]);

    // ── Auto-start on mount ───────────────────────────────────────────────────
    useEffect(() => {
        if (autoStart) startRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Draw flat line when idle ──────────────────────────────────────────────
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

    // ── Cleanup ───────────────────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            streamRef.current?.getTracks().forEach((t) => t.stop());
            cancelAnimationFrame(rafRef.current);
            if (timerRef.current) clearInterval(timerRef.current);
            audioCtxRef.current?.close().catch(() => {});
            recognitionRef.current?.stop();
        };
    }, []);

    const isRecording = phase === "recording";
    const isProcessing = phase === "processing";
    const isDisabled = isProcessing || phase === "done";

    return (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget && !isRecording && !isProcessing) onCancel(); }}>
            <div className="flex flex-col items-center gap-4 p-8 bg-zinc-950 border border-zinc-800 w-full max-w-sm mx-4"
                style={{ boxShadow: "0 0 60px rgba(239,68,68,0.15)" }}>

                {/* Title */}
                <div className="text-xs font-black uppercase tracking-widest text-zinc-500">Voice Note</div>

                {/* Waveform canvas */}
                <canvas ref={canvasRef} width={280} height={56}
                    className="w-full"
                    style={{ background: "transparent" }} />

                {/* Timer */}
                <div className="text-3xl font-black tabular-nums text-white tracking-tight">
                    {fmt(elapsed)}
                </div>

                {/* Live transcript */}
                {(isRecording || liveText) && (
                    <div className="w-full min-h-[48px] max-h-[96px] overflow-y-auto text-[11px] text-zinc-400 leading-relaxed px-3 py-2 border border-zinc-800 bg-black/40"
                        style={{ wordBreak: "break-word" }}>
                        {liveText || <span className="text-zinc-700 italic">Listening…</span>}
                    </div>
                )}

                {/* Status */}
                <div className="flex items-center gap-2 text-xs text-zinc-500 uppercase tracking-widest min-h-[1rem]">
                    {isProcessing && <span className="w-3 h-3 border-2 border-zinc-500 border-t-white rounded-full animate-spin flex-shrink-0" />}
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

                    <button
                        onClick={isRecording ? stopRecording : startRecording}
                        disabled={isDisabled}
                        className="w-14 h-14 flex items-center justify-center transition disabled:opacity-40"
                        style={{
                            background: isRecording ? "#ef4444" : "#ffffff",
                            boxShadow: isRecording ? "0 0 24px rgba(239,68,68,0.6)" : "none",
                        }}>
                        {isRecording ? (
                            <span className="w-4 h-4 bg-white block" />
                        ) : isProcessing ? (
                            <span className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin block" />
                        ) : (
                            <span className="w-5 h-5 rounded-full bg-red-500 block" />
                        )}
                    </button>

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
