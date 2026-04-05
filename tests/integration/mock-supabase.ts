/**
 * Shared Supabase mock builder for integration tests.
 * Creates a chainable mock that handles: select, insert, update, delete, upsert,
 * eq, in, single, order, limit, range, maybeSingle, match, neq, gt, lt, gte, lte
 */
import { vi } from "vitest";

export function createChainMock(resolveData: unknown = [], resolveError: unknown = null) {
    const chain: Record<string, any> = {};
    const terminalResult = { data: resolveData, error: resolveError };

    // All chainable methods return `chain` itself
    const chainableMethods = [
        "select", "insert", "update", "delete", "upsert",
        "eq", "neq", "gt", "lt", "gte", "lte", "in", "is",
        "order", "limit", "range", "match", "filter",
        "not", "or", "contains", "containedBy", "overlaps",
        "textSearch", "ilike", "like",
    ];

    for (const method of chainableMethods) {
        chain[method] = vi.fn().mockReturnValue(chain);
    }

    // Terminal methods resolve with data
    chain.single = vi.fn().mockResolvedValue(terminalResult);
    chain.maybeSingle = vi.fn().mockResolvedValue(terminalResult);
    chain.then = undefined; // Make it not thenable by default

    // Make it also resolve as a promise (for queries without .single())
    const promise = Promise.resolve(terminalResult);
    chain[Symbol.for("nodejs.util.promisify.custom")] = () => promise;

    // Override order/limit to also work as terminal
    const origOrder = chain.order;
    chain.order = vi.fn().mockImplementation((...args: any[]) => {
        origOrder(...args);
        return { ...chain, then: (resolve: any) => resolve(terminalResult) };
    });

    const origLimit = chain.limit;
    chain.limit = vi.fn().mockImplementation((...args: any[]) => {
        origLimit(...args);
        return { ...chain, then: (resolve: any) => resolve(terminalResult) };
    });

    return chain;
}

export function createMockSupabase(defaultData: unknown = [], defaultError: unknown = null) {
    const chain = createChainMock(defaultData, defaultError);
    return {
        auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner-uuid-1234" } }, error: null }),
            signOut: vi.fn().mockResolvedValue({}),
            getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        },
        from: vi.fn().mockReturnValue(chain),
        storage: {
            from: vi.fn().mockReturnValue({
                upload: vi.fn().mockResolvedValue({ error: null }),
                getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "https://test.com/file.png" } }),
            }),
        },
        _chain: chain, // expose for test assertions
    };
}
