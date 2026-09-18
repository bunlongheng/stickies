/**
 * The single database-access seam for the whole app. Every route and lib imports
 * query/queryOne/execute from HERE (not from lib/db directly), which is why the
 * 2026-05-19 Supabase removal was a one-file change and why the test suite mocks
 * `@/lib/db-driver` in one place (26 files) to stub the DB. Keep this indirection:
 * it is the deliberate choke point, not leftover scaffolding.
 */
export { query, queryOne, execute } from "@/lib/db";
