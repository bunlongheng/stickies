// Resolves the machine that made an API call from its request IP, and maps a
// machine name to a device icon (mirrored from the local-apps device registry
// into /public/machines). The stickies server runs on the M4 hub, so direct
// localhost posts (no forwarded IP) are attributed to that hub.

const HUB = "M4";

// Known IP -> machine name. Peers post over LAN/Tailscale so their source IP
// arrives in x-forwarded-for; the hub posts to itself as localhost.
const MACHINE_BY_IP: Record<string, string> = {
    "10.0.0.218": "M4",
    "10.0.0.47": "GV741W2732",
};

// Machine name -> device model, used to pick the icon.
const MACHINE_MODEL: Record<string, string> = {
    "M4": "mac mini",
    "PM2026": "mac mini",
    "GV741W2732": "macbook pro",
};

const DEVICE_ICON: Record<string, string> = {
    "mac mini": "mac-mini.png",
    "macbook pro": "macbook-pro.png",
    "macbook air": "macbook-air.png",
};

/** Map a request IP to a machine name. localhost/empty = the hub (M4). */
export function machineForIp(ip: string | null | undefined): string | null {
    const x = (ip ?? "").trim();
    if (!x || x === "127.0.0.1" || x === "::1" || x === "::ffff:127.0.0.1") return HUB;
    const norm = x.replace(/^::ffff:/, "");
    return MACHINE_BY_IP[norm] ?? norm; // known name, else the raw IP so it is still recorded
}

/** Resolve the device icon for a machine name, or null (caller falls back to a text chip). */
export function machineIcon(machine: string | null | undefined): string | null {
    if (!machine) return null;
    const model = MACHINE_MODEL[machine];
    const file = model ? DEVICE_ICON[model] : undefined;
    return file ? `/machines/${file}` : null;
}
