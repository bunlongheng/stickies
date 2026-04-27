import { Pool } from "pg";

let pool: Pool | null = null;

export function getPool(): Pool {
    if (!pool) {
        const connStr = process.env.DATABASE_URL ?? "";
        const isRemote = !connStr.includes("@localhost");
        pool = new Pool({
            connectionString: connStr,
            ssl: isRemote ? { rejectUnauthorized: false } : false,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
            statement_timeout: 10000,
        });
    }
    return pool;
}

/** Run a query and return rows */
export async function query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
): Promise<T[]> {
    const result = await getPool().query(sql, params);
    return result.rows as T[];
}

/** Run a query and return the first row (or null) */
export async function queryOne<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
): Promise<T | null> {
    const result = await getPool().query(sql, params);
    return (result.rows[0] as T) ?? null;
}

/** Run a query and return rowCount */
export async function execute(sql: string, params?: unknown[]): Promise<number> {
    const result = await getPool().query(sql, params);
    return result.rowCount ?? 0;
}
