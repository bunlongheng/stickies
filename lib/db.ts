import { Pool } from "pg";

let pool: Pool | null = null;
let warnedNoCa = false;

/**
 * TLS config for the pg Pool. Local (@localhost) connections use no TLS. For a
 * remote DB, when DATABASE_CA_CERT is supplied (raw PEM or base64) the server
 * certificate is VERIFIED (rejectUnauthorized: true). Without it we keep the
 * connection working but log a one-time warning - the cert is then unverified,
 * which is the one remaining TLS gap to close by supplying the CA.
 */
export function sslConfig(isRemote: boolean): false | { ca?: string; rejectUnauthorized: boolean } {
    if (!isRemote) return false;
    const raw = process.env.DATABASE_CA_CERT?.trim();
    if (raw) {
        const ca = raw.includes("BEGIN CERTIFICATE") ? raw : Buffer.from(raw, "base64").toString("utf8");
        return { ca, rejectUnauthorized: true };
    }
    // NOTE: fail-closed in prod is intended here, but DATABASE_CA_CERT is not yet
    // provisioned on Vercel/M4 - throwing now would take prod down. Provision the
    // Linode CA in both envs first, then flip this to throw when VERCEL_ENV==='production'.
    if (!warnedNoCa) {
        warnedNoCa = true;
        console.warn("[db] DATABASE_CA_CERT not set - remote DB TLS certificate is NOT verified. Supply the CA (raw PEM or base64) to enable rejectUnauthorized:true.");
    }
    return { rejectUnauthorized: false };
}

export function getPool(): Pool {
    if (!pool) {
        const connStr = process.env.DATABASE_URL ?? "";
        const isRemote = !connStr.includes("@localhost");
        pool = new Pool({
            connectionString: connStr,
            ssl: sslConfig(isRemote),
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
