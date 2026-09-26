/**
 * One realtime channel, two transports.
 *
 * With stickies-api configured this is a plain EventSource against its /live
 * stream. Without it, it is the Pusher channel this app has always used. The
 * binding code in useRealtimeSync does not care which: both expose bind() and
 * close(), and both deliver the same event names with the same payloads.
 *
 * SSE is the better of the two here. The server holds the connection itself, so
 * there is no 10KB event ceiling, no third party, and no key in the bundle.
 */
import PusherClient from "pusher-js";
import { apiUrl, usingRemoteApi, accessToken } from "@/lib/api-client";

export interface RealtimeChannel {
    bind: (event: string, handler: (payload: any) => void) => void;
    close: () => void;
    /** Pusher's socket id, which the app uses to ignore echoes of its own writes. */
    socketId: () => string | undefined;
}

export function openRealtimeChannel(onConnect: () => void): RealtimeChannel | null {
    if (usingRemoteApi) {
        // EventSource cannot set an Authorization header, so the token goes in
        // the query string. On a LAN or dev host there is no token and the
        // service trusts the origin instead.
        const token = accessToken();
        const url = apiUrl("/api/live") + (token ? `?access_token=${encodeURIComponent(token)}` : "");
        const source = new EventSource(url, { withCredentials: true });
        // `ready` is the service confirming the stream is live, so it is the same
        // moment Pusher's "connected" was: the cue to run the catch-up fetch.
        source.addEventListener("ready", () => onConnect());
        // A dropped stream reconnects on its own, and every reconnect may have
        // missed events, so the catch-up runs again.
        source.addEventListener("open", () => onConnect());
        return {
            bind: (event, handler) => {
                source.addEventListener(event, (e) => {
                    try { handler(JSON.parse((e as MessageEvent).data)); }
                    catch { /* a ping or a malformed frame, nothing to deliver */ }
                });
            },
            close: () => source.close(),
            // SSE has no socket id. Nothing echoes back here: the server never
            // sends an event to the connection that caused it.
            socketId: () => undefined,
        };
    }

    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!key || !cluster) return null;

    const pusher = new PusherClient(key, { cluster });
    pusher.connection.bind("connected", () => onConnect());
    const channel = pusher.subscribe("stickies");
    return {
        bind: (event, handler) => channel.bind(event, handler),
        close: () => { channel.unbind_all(); pusher.unsubscribe("stickies"); pusher.disconnect(); },
        socketId: () => pusher.connection.socket_id,
    };
}
