import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { machineForIp, isHubMachine, machineIcon, hubMachineIcon, isOwnerBrowserNote } from "@/lib/machines";

// The registry is env-driven configuration, so every test declares the fleet it
// expects. Addresses are RFC 5737 documentation addresses, never real ones.
beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_STICKIES_HUB_MACHINE", "Hub");
    vi.stubEnv("NEXT_PUBLIC_STICKIES_MACHINE_IPS", "192.0.2.10=Hub,192.0.2.11=Laptop");
    vi.stubEnv("NEXT_PUBLIC_STICKIES_MACHINE_MODELS", "Hub=mac mini,Laptop=macbook pro");
    vi.stubEnv("NEXT_PUBLIC_STICKIES_FORCE_MACHINES", "Laptop");
});
afterEach(() => vi.unstubAllEnvs());

describe("machineForIp", () => {
    it("maps localhost/empty to the hub", () => {
        expect(machineForIp(null)).toBe("Hub");
        expect(machineForIp("")).toBe("Hub");
        expect(machineForIp("127.0.0.1")).toBe("Hub");
        expect(machineForIp("::1")).toBe("Hub");
    });
    it("maps known IPs to their machine name", () => {
        expect(machineForIp("192.0.2.11")).toBe("Laptop");
        expect(machineForIp("::ffff:192.0.2.11")).toBe("Laptop");
    });
    it("returns the raw IP for unknown hosts", () => {
        expect(machineForIp("192.0.2.99")).toBe("192.0.2.99");
    });
    it("falls back to a neutral hub name when unconfigured", () => {
        vi.stubEnv("NEXT_PUBLIC_STICKIES_HUB_MACHINE", "");
        vi.stubEnv("NEXT_PUBLIC_STICKIES_MACHINE_IPS", "");
        expect(machineForIp("127.0.0.1")).toBe("hub");
        expect(machineForIp("192.0.2.11")).toBe("192.0.2.11"); // no registry, no name
    });
});

describe("isHubMachine", () => {
    it("is true only for the hub", () => {
        expect(isHubMachine("Hub")).toBe(true);
        expect(isHubMachine(" Hub ")).toBe(true);
        expect(isHubMachine("Laptop")).toBe(false);
        expect(isHubMachine(null)).toBe(false);
    });
});

describe("machineIcon", () => {
    it("returns null for the hub and unknown machines", () => {
        expect(machineIcon("Hub")).toBeNull();
        expect(machineIcon(null)).toBeNull();
        expect(machineIcon("Unknown")).toBeNull();
    });
    it("resolves a device icon for a known non-hub machine", () => {
        expect(machineIcon("Laptop")).toBe("/machines/macbook-m2.png?v=3");
    });
    it("hubMachineIcon returns the hub device icon", () => {
        expect(hubMachineIcon()).toBe("/machines/mac-mini.png?v=3");
    });
    it("hubMachineIcon falls back when the hub has no model configured", () => {
        vi.stubEnv("NEXT_PUBLIC_STICKIES_MACHINE_MODELS", "");
        expect(hubMachineIcon()).toBe("/machines/mac-mini.png?v=3");
    });
});

describe("isOwnerBrowserNote", () => {
    it("is true for a browser note from a non-hub, no-icon machine", () => {
        // no key, unknown peer machine -> owner on another box
        expect(isOwnerBrowserNote(null, "SomeLaptop")).toBe(true);
        expect(isOwnerBrowserNote("stickies", "SomeLaptop")).toBe(true);
    });
    it("is false when an external API key is present", () => {
        expect(isOwnerBrowserNote("3pi", "SomeLaptop")).toBe(false);
    });
    it("is false for the hub or a known-icon machine", () => {
        expect(isOwnerBrowserNote(null, "Hub")).toBe(false);
        expect(isOwnerBrowserNote(null, "Laptop")).toBe(false); // has a device icon
    });
    it("is false with no machine", () => {
        expect(isOwnerBrowserNote(null, null)).toBe(false);
    });
});
