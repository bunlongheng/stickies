/**
 * DB driver switcher.
 *
 * DB_DRIVER=postgres  (default) → direct Supabase PostgreSQL via DATABASE_URL
 * DB_DRIVER=supabase             → Supabase Management API (fallback if direct quota exhausted)
 *
 * Both adapters expose the same query/queryOne/execute interface.
 */
import {
    query as pgQuery,
    queryOne as pgQueryOne,
    execute as pgExecute,
} from "@/lib/db";
import {
    query as sbQuery,
    queryOne as sbQueryOne,
    execute as sbExecute,
} from "@/lib/db-supabase";

const driver = (process.env.DB_DRIVER ?? "postgres").toLowerCase();
const isSupabase = driver === "supabase";

export const query     = isSupabase ? sbQuery     : pgQuery;
export const queryOne  = isSupabase ? sbQueryOne  : pgQueryOne;
export const execute   = isSupabase ? sbExecute   : pgExecute;
