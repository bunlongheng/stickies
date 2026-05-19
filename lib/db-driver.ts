/**
 * DB driver. After the Supabase removal (2026-05-19), only the direct Postgres
 * (Linode) connection is supported. DB_DRIVER is kept as an env var for
 * config-file compatibility but is otherwise ignored.
 */
export { query, queryOne, execute } from "@/lib/db";
