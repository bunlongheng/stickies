import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
    return new ImageResponse(
        (
            <div
                style={{
                    background: "hsl(48, 90%, 52%)",
                    width: "100%",
                    height: "100%",
                    borderRadius: "40px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                {/* Sticky note */}
                <div
                    style={{
                        width: 100,
                        height: 112,
                        background: "white",
                        borderRadius: 12,
                        display: "flex",
                        flexDirection: "column",
                        padding: "18px 16px",
                        gap: 12,
                    }}
                >
                    <div style={{ width: "100%", height: 8, background: "hsl(48, 90%, 45%)", borderRadius: 4 }} />
                    <div style={{ width: "80%",  height: 8, background: "hsl(48, 90%, 45%)", borderRadius: 4 }} />
                    <div style={{ width: "90%",  height: 8, background: "hsl(48, 90%, 45%)", borderRadius: 4 }} />
                    <div style={{ width: "60%",  height: 8, background: "hsl(48, 90%, 45%)", borderRadius: 4 }} />
                </div>
            </div>
        ),
        { ...size }
    );
}
