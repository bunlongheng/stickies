/**
 * NextAuth v5 (Auth.js) configuration.
 *
 * Single-user app: only the owner (matched by OWNER_EMAIL or OWNER_USER_ID) can sign in.
 * All other Google identities get rejected at the signIn callback so the auth table
 * stays clean and we don't accidentally hand out access via a Google account someone
 * else owns.
 *
 * Sessions are stored in the Linode Postgres (same connection string as the rest of
 * the app) so nothing depends on a third-party quota.
 */
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import PostgresAdapter from "@auth/pg-adapter";
import { Pool } from "pg";

// Reuse a single Pool across edge / serverless invocations.
let pool: Pool | null = null;
function getPool(): Pool {
    if (!pool) {
        const connStr = process.env.DATABASE_URL ?? "";
        const isRemote = !connStr.includes("@localhost");
        pool = new Pool({
            connectionString: connStr,
            ssl: isRemote ? { rejectUnauthorized: false } : false,
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });
    }
    return pool;
}

const OWNER_EMAIL = process.env.OWNER_EMAIL?.trim().toLowerCase();

export const { handlers, signIn, signOut, auth } = NextAuth({
    adapter: PostgresAdapter(getPool()),
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
    ],
    pages: {
        signIn: "/sign-in",
    },
    callbacks: {
        // Gate sign-in: only the owner email passes. Everyone else gets rejected
        // BEFORE we write to the auth tables.
        async signIn({ user }) {
            if (!user.email) return false;
            if (!OWNER_EMAIL) {
                // No owner configured — refuse all (safer than open access).
                console.warn("[auth] OWNER_EMAIL not configured; rejecting sign-in");
                return false;
            }
            return user.email.toLowerCase() === OWNER_EMAIL;
        },
        // Attach the legacy OWNER_USER_ID to the session so existing notes
        // (user_id='731ace87-...') still resolve without a data migration.
        async session({ session, user }) {
            const ownerUserId = process.env.OWNER_USER_ID?.trim();
            if (session.user) {
                // Keep the next-auth user.id (auth tables) AND surface the legacy id.
                (session.user as any).id = user.id;
                (session.user as any).legacyId = ownerUserId ?? user.id;
            }
            return session;
        },
    },
    session: { strategy: "database" },
});
