import { Suspense } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { isLocalHostname } from "@/lib/is-local";
import { auth } from "@/auth";

/**
 * Owner gate. Lives INSIDE a Suspense boundary so the dark shell below streams
 * to the browser immediately; the session lookup (a cold Vercel function plus
 * the Postgres roundtrip, 1 to 3s) no longer holds back the whole document and
 * shows a blank white canvas while it waits. redirect() inside a streamed
 * boundary is supported by Next (it emits the client-side redirect).
 */
async function OwnerGate({ children }: { children: React.ReactNode }) {
    const headersList = await headers();
    const host = (headersList.get("host") || "").replace(/:\d+$/, "");
    // Keyless for local/LAN hosts (the M4 hub). Checked on the REAL Host header:
    // the old synthetic Request("http://localhost") made isLocal() fall back to
    // that URL's hostname, so this gate silently passed every host.
    if (!isLocalHostname(host)) {
        const session = await auth();
        const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
        if (!session?.user?.email || session.user.email.toLowerCase() !== ownerEmail) {
            redirect("/sign-in");
        }
    }
    return <>{children}</>;
}

/** Instant black shell: what the user sees during the server wait instead of white. */
function Shell() {
    return (
        <div style={{ height: "100dvh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }} aria-busy="true" aria-label="Loading Stickies">
            <style>{`@keyframes stickiesShellBreath{0%,100%{transform:scale(1) rotate(-3deg);opacity:.85}50%{transform:scale(1.06) rotate(2deg);opacity:1}}`}</style>
            <div style={{ width: 72, height: 72, borderRadius: 16, background: "#FFCC00", boxShadow: "0 18px 40px rgba(255,204,0,.28)", animation: "stickiesShellBreath 1.1s ease-in-out infinite" }} />
        </div>
    );
}

export default function StickiesLayout({ children }: { children: React.ReactNode }) {
    return (
        <Suspense fallback={<Shell />}>
            <OwnerGate>{children}</OwnerGate>
        </Suspense>
    );
}
