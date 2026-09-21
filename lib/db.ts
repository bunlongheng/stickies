import { Pool } from "pg";

let pool: Pool | null = null;
let warnedNoCa = false;

/**
 * TLS config for the pg Pool. Local (@localhost) connections use no TLS. For a
 * remote DB, when DATABASE_CA_CERT is supplied (raw PEM or base64) the server
 * certificate is VERIFIED (rejectUnauthorized: true). Without it, production refuses
 * to connect at all; everywhere else logs a one-time warning so local work is never
 * blocked by a missing CA.
 */
export function sslConfig(isRemote: boolean): false | { ca?: string; rejectUnauthorized: boolean } {
    if (!isRemote) return false;
    const raw = process.env.DATABASE_CA_CERT?.trim();
    if (raw) {
        const ca = raw.includes("BEGIN CERTIFICATE") ? raw : Buffer.from(raw, "base64").toString("utf8");
        return { ca, rejectUnauthorized: true };
    }
    // Fail closed in production. The CA is provisioned on Vercel and the M4 hub
    // (2026-09-21), so a missing one now means a misconfiguration, not a migration
    // step - and silently downgrading to an unverified connection is the failure mode
    // this whole gap was about. Off-prod still warns so local work is not blocked.
    if (process.env.VERCEL_ENV === "production") {
        throw new Error(
            "DATABASE_CA_CERT is required in production: refusing to open an unverified TLS connection to Postgres."
        );
    }
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
