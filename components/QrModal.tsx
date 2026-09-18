import React from "react";
import { QRCodeCanvas } from "qrcode.react";

/**
 * Full-screen QR overlay for sharing a note as a link or as raw data.
 * Presentational: the copy action and close are delegated. Parent guards
 * mounting with `{qrModalOpen && <QrModal .../>}`.
 */
export function QrModal({
    qrType,
    qrData,
    accentColor,
    copied,
    onCopy,
    onClose,
}: {
    qrType: "link" | "data";
    qrData: string;
    accentColor: string;
    copied: boolean;
    onCopy: () => void;
    onClose: () => void;
}) {
    const accent = accentColor;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return (
        <div className="fixed inset-0 z-[520] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-zinc-900 p-6 sm:p-8 flex flex-col items-center gap-4 w-full max-w-[360px]"
                style={{ border: `2px solid ${accent}` }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Title */}
                <div className="flex items-center gap-2">
                    <h2 className="font-black uppercase tracking-widest text-sm sm:text-base" style={{ color: accent }}>
                        {qrType === "link" ? "QR - Link" : "QR - Data"}
                    </h2>
                </div>
                {qrType === "data" && (
                    <p className="text-[10px] text-zinc-500 text-center -mt-2">Scan to copy note content</p>
                )}
                {qrType === "link" && (
                    <p className="text-[10px] text-zinc-500 text-center -mt-2 font-mono break-all">{qrData.replace(origin, "")}</p>
                )}

                {/* QR code */}
                <div className="p-3 bg-white" style={{ border: `4px solid ${accent}` }}>
                    <QRCodeCanvas value={qrData || " "} size={280} level={qrType === "data" ? "L" : "M"} marginSize={2} />
                </div>

                {/* Copy link button */}
                <button
                    type="button"
                    onClick={onCopy}
                    className="w-full py-3 font-black uppercase text-xs tracking-wide transition-colors flex items-center justify-center gap-2"
                    style={{ backgroundColor: copied ? "#22c55e" : accent, color: "#000" }}
                >
                    {copied ? (
                        <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Copied</>
                    ) : (
                        <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg> {qrType === "data" ? "Copy Content" : "Copy Link"}</>
                    )}
                </button>

                <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-2.5 border border-white/15 text-zinc-400 font-black uppercase text-xs tracking-wide hover:border-white/30 hover:text-white transition"
                >
                    Close
                </button>
            </div>
        </div>
    );
}
