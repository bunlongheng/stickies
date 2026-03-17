/**
 * Supabase adapter — uses the Supabase Management API to execute raw SQL.
 *
 * Endpoint: POST https://api.supabase.com/v1/projects/{ref}/database/query
 * Auth: Bearer SUPABASE_MANAGEMENT_TOKEN  (personal access token, NOT the service role key)
 *
 * Required env vars:
 *   SUPABASE_PROJECT_REF       — e.g. "erhdiqjagmqbtmjblpbo"
 *   SUPABASE_MANAGEMENT_TOKEN  — personal access token from supabase.com/dashboard/account/tokens
 *
 * Same query / queryOne / execute interface as lib/db.ts so the rest of the
 * codebase (route.ts etc.) requires zero changes when switching drivers.
 */

const BASE = "https://api.supabase.com/v1/projects";

/** Inline $1,$2,… params into SQL as SQL literals (Postgres standard quoting). */
function formatQuery(sql: string, params?: unknown[]): string {
    if (!params || params.length === 0) return sql;
    return sql.replace(/\$(\d+)/g, (_, n) => {
        const val = params[parseInt(n, 10) - 1];
        if (val === null || val === undefined) return "NULL";
        if (typeof val === "number") return String(val);
        if (typeof val === "boolean") return val ? "true" : "false";
        // String: escape single quotes by doubling them (standard SQL)
        return `'${String(val).replace(/'/g, "''")}'`;
    });
}

async function runQuery(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]> {
    const ref   = process.env.SUPABASE_PROJECT_REF!;
    const token = process.env.SUPABASE_MANAGEMENT_TOKEN!;
    const query = formatQuery(sql, params);

    const res = await fetch(`${BASE}/${ref}/database/query`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type":  "application/json",
        },
        body: JSON.stringify({ query }),
    });

    if (!res.ok) {
        const err = await res.text().catch(() => res.statusText);
        throw new Error(`Supabase query failed (${res.status}): ${err}`);
    }

    const data = await res.json();
    // Returns an array of row objects; empty array for no-result DML
    if (!Array.isArray(data)) return [];
    return data as Record<string, unknown>[];
}

export async function query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
): Promise<T[]> {
    return (await runQuery(sql, params)) as T[];
}

export async function queryOne<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
): Promise<T | null> {
    const rows = await runQuery(sql, params);
    return (rows[0] as T) ?? null;
}

export async function execute(sql: string, params?: unknown[]): Promise<number> {
    const rows = await runQuery(sql, params);
    return rows.length;
}
