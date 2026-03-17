/**
 * DB driver switcher.
 *
 * Set DB_DRIVER in your environment to control which backend is used:
 *   DB_DRIVER=postgres  → Linode PostgreSQL via DATABASE_URL          (default)
 *   DB_DRIVER=supabase  → Supabase PostgreSQL via DATABASE_URL_SUPABASE
 *
 * Both adapters expose the same query/queryOne/execute interface so the
 * rest of the codebase (route.ts etc.) needs zero changes when switching.
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
