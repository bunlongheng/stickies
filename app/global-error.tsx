"use client";
import ErrorPanel from "@/components/ErrorPanel";

// Catches errors thrown by the root layout itself (error.tsx cannot). Must render
// its own <html>/<body> because it replaces the root layout.
export default function GlobalError(props: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <html lang="en">
            <body style={{ margin: 0, background: "#000" }}>
                <ErrorPanel {...props} />
            </body>
        </html>
    );
}
