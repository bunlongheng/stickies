import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
    return new ImageResponse(
        (
            <div
                style={{
                    background: "hsl(48, 90%, 52%)",
                    width: "100%",
                    height: "100%",
                    borderRadius: "22%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                {/* Sticky note */}
                <div
                    style={{
                        width: 18,
                        height: 20,
                        background: "white",
                        borderRadius: 3,
                        display: "flex",
                        flexDirection: "column",
                        padding: "4px 4px",
                        gap: 3,
                    }}
                >
                    <div style={{ width: "100%", height: 2, background: "hsl(48, 90%, 45%)", borderRadius: 1 }} />
                    <div style={{ width: "80%",  height: 2, background: "hsl(48, 90%, 45%)", borderRadius: 1 }} />
                    <div style={{ width: "90%",  height: 2, background: "hsl(48, 90%, 45%)", borderRadius: 1 }} />
                    <div style={{ width: "60%",  height: 2, background: "hsl(48, 90%, 45%)", borderRadius: 1 }} />
                </div>
            </div>
        ),
        { ...size }
    );
}
