import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const lookup = vi.fn();
vi.mock("node:dns/promises", () => ({ lookup: (...a: unknown[]) => lookup(...a) }));

import { machineForRequestIp } from "@/lib/machine-lookup";

// Addresses are RFC 5737 documentation addresses, never real ones.
describe("machineForRequestIp", () => {
    beforeEach(() => {
        lookup.mockReset();
        vi.stubEnv("NEXT_PUBLIC_STICKIES_HUB_MACHINE", "Hub");
        vi.stubEnv("NEXT_PUBLIC_STICKIES_MACHINE_IPS", "192.0.2.10=Hub,192.0.2.11=Laptop");
        vi.stubEnv("STICKIES_PEER_HOSTS", "Laptop");
    });
    afterEach(() => vi.unstubAllEnvs());

    it("keeps the hub and statically known IPs without a lookup", async () => {
        expect(await machineForRequestIp("127.0.0.1")).toBe("Hub");
        expect(await machineForRequestIp("192.0.2.11")).toBe("Laptop");
        expect(lookup).not.toHaveBeenCalled();
    });

    it("names an unknown IP that matches a peer's Bonjour address", async () => {
        lookup.mockResolvedValue({ address: "192.0.2.201", family: 4 });
        expect(await machineForRequestIp("192.0.2.201")).toBe("Laptop");
        expect(lookup).toHaveBeenCalledWith("Laptop.local", { family: 4 });
    });

    it("keeps the raw IP when no peer resolves to it", async () => {
        lookup.mockImplementation(async () => { throw new Error("ENOTFOUND"); });
        expect(await machineForRequestIp("192.0.2.202")).toBe("192.0.2.202");
    });

    it("skips the lookup entirely when no peers are configured", async () => {
        vi.stubEnv("STICKIES_PEER_HOSTS", "");
        expect(await machineForRequestIp("192.0.2.204")).toBe("192.0.2.204");
        expect(lookup).not.toHaveBeenCalled();
    });

    it("caches the answer per IP", async () => {
        lookup.mockResolvedValue({ address: "192.0.2.203", family: 4 });
        await machineForRequestIp("192.0.2.203");
        await machineForRequestIp("192.0.2.203");
        expect(lookup).toHaveBeenCalledTimes(1);
    });
});
