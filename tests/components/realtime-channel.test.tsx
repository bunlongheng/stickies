// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

const pusherInstance = {
    connection: { bind: vi.fn(), socket_id: "sock-7" },
    subscribe: vi.fn(() => channelStub),
    unsubscribe: vi.fn(),
    disconnect: vi.fn(),
};
const channelStub = { bind: vi.fn(), unbind_all: vi.fn() };
vi.mock("pusher-js", () => ({ default: class { constructor() { return pusherInstance; } } }));

/** Minimal EventSource: records listeners so the test can deliver frames. */
class FakeSource {
    static last: FakeSource;
    listeners = new Map<string, (e: any) => void>();
    closed = false;
    constructor(public url: string, public init?: unknown) { FakeSource.last = this; }
    addEventListener(name: string, fn: (e: any) => void) { this.listeners.set(name, fn); }
    close() { this.closed = true; }
    emit(name: string, data?: string) { this.listeners.get(name)?.({ data } as MessageEvent); }
}

beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); (globalThis as any).EventSource = FakeSource; });

async function load(remote: { base?: string; token?: string | null }) {
    vi.doMock("@/lib/api-client", () => ({
        usingRemoteApi: !!remote.base,
        apiUrl: (p: string) => (remote.base ? `${remote.base}${p}` : p),
        accessToken: () => remote.token ?? null,
    }));
    return (await import("@/lib/realtime-channel")).openRealtimeChannel;
}

describe("openRealtimeChannel - SSE transport", () => {
    it("streams from the service, with the token in the query string", async () => {
        const open = await load({ base: "https://api.example.com", token: "t ok" });
        const onConnect = vi.fn();
        const ch = open(onConnect)!;
        expect(FakeSource.last.url).toBe("https://api.example.com/api/live?access_token=t%20ok");
        expect(ch.socketId()).toBeUndefined();
    });

    it("omits the token when there is none", async () => {
        const open = await load({ base: "https://api.example.com", token: null });
        open(vi.fn());
        expect(FakeSource.last.url).toBe("https://api.example.com/api/live");
    });

    it("runs the catch-up on ready and on every reconnect", async () => {
        const open = await load({ base: "https://api.example.com" });
        const onConnect = vi.fn();
        open(onConnect);
        FakeSource.last.emit("ready");
        FakeSource.last.emit("open");
        expect(onConnect).toHaveBeenCalledTimes(2);
    });

    it("parses a frame, and swallows a ping or a malformed one", async () => {
        const open = await load({ base: "https://api.example.com" });
        const ch = open(vi.fn())!;
        const handler = vi.fn();
        ch.bind("note-created", handler);
        FakeSource.last.emit("note-created", JSON.stringify({ id: "n1" }));
        expect(handler).toHaveBeenCalledWith({ id: "n1" });
        expect(() => FakeSource.last.emit("note-created", "not json")).not.toThrow();
        expect(handler).toHaveBeenCalledOnce();
    });

    it("closes the stream", async () => {
        const open = await load({ base: "https://api.example.com" });
        open(vi.fn())!.close();
        expect(FakeSource.last.closed).toBe(true);
    });
});

describe("openRealtimeChannel - Pusher transport", () => {
    it("returns nothing when the keys are missing", async () => {
        const open = await load({});
        delete process.env.NEXT_PUBLIC_PUSHER_KEY;
        delete process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
        expect(open(vi.fn())).toBeNull();
    });

    it("subscribes, binds, reports the socket id, and tears down on close", async () => {
        process.env.NEXT_PUBLIC_PUSHER_KEY = "k";
        process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "mt1";
        const open = await load({});
        const ch = open(vi.fn())!;
        expect(pusherInstance.subscribe).toHaveBeenCalledWith("stickies");
        const handler = vi.fn();
        ch.bind("note-updated", handler);
        expect(channelStub.bind).toHaveBeenCalledWith("note-updated", handler);
        expect(ch.socketId()).toBe("sock-7");
        ch.close();
        expect(channelStub.unbind_all).toHaveBeenCalled();
        expect(pusherInstance.unsubscribe).toHaveBeenCalledWith("stickies");
        expect(pusherInstance.disconnect).toHaveBeenCalled();
    });
});
