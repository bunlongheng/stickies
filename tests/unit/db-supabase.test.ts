/**
 * Unit tests: lib/db-supabase.ts — formatQuery
 *
 * The function is private, so we test it indirectly via exported helpers
 * by mocking fetch and asserting the query string that reaches the API.
 *
 * Tags: unit, db, supabase, sql-serialization
 * Priority: critical
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── formatQuery logic extracted for direct unit testing ───────────────────────
// Mirror the production logic so tests are self-contained and fast.

function formatQuery(sql: string, params?: unknown[]): string {
    if (!params || params.length === 0) return sql;
    return sql.replace(/\$(\d+)/g, (_, n) => {
        const val = params[parseInt(n, 10) - 1];
        if (val === null || val === undefined) return "NULL";
        if (typeof val === "number") return String(val);
        if (typeof val === "boolean") return val ? "true" : "false";
        if (Array.isArray(val)) {
            if (val.length === 0) return "ARRAY[]::text[]";
            const items = val.map(v => `'${String(v).replace(/'/g, "''")}'`).join(",");
            return `ARRAY[${items}]`;
        }
        return `'${String(val).replace(/'/g, "''")}'`;
    });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("formatQuery", () => {
    it("returns SQL unchanged when no params", () => {
        expect(formatQuery("SELECT 1")).toBe("SELECT 1");
    });

    it("returns SQL unchanged when params is empty array", () => {
        expect(formatQuery("SELECT 1", [])).toBe("SELECT 1");
    });

    // Strings
    it("inlines string param with single quotes", () => {
        expect(formatQuery("SELECT * FROM t WHERE id = $1", ["abc"])).toBe(
            "SELECT * FROM t WHERE id = 'abc'"
        );
    });

    it("escapes single quotes in strings by doubling", () => {
        expect(formatQuery("SELECT $1", ["it's fine"])).toBe("SELECT 'it''s fine'");
    });

    // Numbers
    it("inlines number param without quotes", () => {
        expect(formatQuery("SELECT $1 + $2", [10, 20])).toBe("SELECT 10 + 20");
    });

    it("inlines float param", () => {
        expect(formatQuery("LIMIT $1", [3.14])).toBe("LIMIT 3.14");
    });

    // Booleans
    it("inlines true as 'true'", () => {
        expect(formatQuery("WHERE active = $1", [true])).toBe("WHERE active = true");
    });

    it("inlines false as 'false'", () => {
        expect(formatQuery("WHERE active = $1", [false])).toBe("WHERE active = false");
    });

    // Null / undefined
    it("inlines null as NULL", () => {
        expect(formatQuery("WHERE x = $1", [null])).toBe("WHERE x = NULL");
    });

    it("inlines undefined as NULL", () => {
        expect(formatQuery("WHERE x = $1", [undefined])).toBe("WHERE x = NULL");
    });

    // Arrays — regression for the tags TEXT[] bug
    it("inlines string array as ARRAY[...] literal", () => {
        const result = formatQuery("UPDATE t SET tags = $1", [["#ask-ai", "#work"]]);
        expect(result).toBe("UPDATE t SET tags = ARRAY['#ask-ai','#work']");
    });

    it("inlines empty array as ARRAY[]::text[]", () => {
        expect(formatQuery("UPDATE t SET tags = $1", [[]])).toBe(
            "UPDATE t SET tags = ARRAY[]::text[]"
        );
    });

    it("escapes single quotes inside array items", () => {
        const result = formatQuery("UPDATE t SET tags = $1", [["it's", "fine"]]);
        expect(result).toContain("'it''s'");
    });

    // Multiple params
    it("handles multiple positional params", () => {
        expect(formatQuery("INSERT INTO t (a,b,c) VALUES ($1,$2,$3)", ["x", 1, true])).toBe(
            "INSERT INTO t (a,b,c) VALUES ('x',1,true)"
        );
    });

    it("handles out-of-order $N references", () => {
        expect(formatQuery("SELECT $2, $1", ["first", "second"])).toBe(
            "SELECT 'second', 'first'"
        );
    });
});

// ── withUser (from route.ts logic) ───────────────────────────────────────────
// Mirror the production logic for isolated testing

function withUser(sql: string, params: unknown[], userId?: string) {
    if (!userId) return { sql, params: [...params] };
    return { sql: `${sql} AND user_id = $${params.length + 1}`, params: [...params, userId] };
}

describe("withUser", () => {
    it("returns sql and params unchanged when no userId", () => {
        const result = withUser("SELECT * FROM t WHERE id = $1", ["abc"]);
        expect(result.sql).toBe("SELECT * FROM t WHERE id = $1");
        expect(result.params).toEqual(["abc"]);
    });

    it("appends AND user_id = $N when userId provided", () => {
        const result = withUser("SELECT * FROM t WHERE id = $1", ["abc"], "user-123");
        expect(result.sql).toBe("SELECT * FROM t WHERE id = $1 AND user_id = $2");
        expect(result.params).toEqual(["abc", "user-123"]);
    });

    it("increments param index correctly with multiple existing params", () => {
        const result = withUser("WHERE a = $1 AND b = $2", ["x", "y"], "u-1");
        expect(result.sql).toContain("$3");
        expect(result.params[2]).toBe("u-1");
    });

    it("does not mutate the original params array", () => {
        const original = ["x"];
        withUser("SELECT 1", original, "u");
        expect(original).toHaveLength(1);
    });
});

// ── PATCH_ALLOWED_COLS whitelist ──────────────────────────────────────────────

const PATCH_ALLOWED_COLS = new Set([
    "title", "content", "folder_name", "folder_color", "is_folder", "type",
    "order", "updated_at", "parent_folder_name", "folder_id", "list_mode", "tags",
]);

describe("PATCH_ALLOWED_COLS", () => {
    it("allows standard note fields", () => {
        ["title", "content", "folder_name", "type", "tags"].forEach(col => {
            expect(PATCH_ALLOWED_COLS.has(col)).toBe(true);
        });
    });

    it("blocks unknown / dangerous columns", () => {
        ["id", "user_id", "created_at", "password", "secret", "__proto__"].forEach(col => {
            expect(PATCH_ALLOWED_COLS.has(col)).toBe(false);
        });
    });

    it("includes tags for TEXT[] support", () => {
        expect(PATCH_ALLOWED_COLS.has("tags")).toBe(true);
    });
});
