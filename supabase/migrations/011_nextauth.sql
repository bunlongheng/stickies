-- NextAuth v5 (Auth.js) Postgres adapter schema.
-- Source: https://authjs.dev/getting-started/adapters/pg
-- Tables: users, accounts, sessions, verification_token.
-- The application's existing notes are user_id-scoped via the OWNER_USER_ID UUID
-- ('731ace87-...'). The NextAuth `users.id` is a SERIAL int, kept separate.
-- The session callback in auth.ts surfaces OWNER_USER_ID as session.user.legacyId so
-- existing data continues to resolve without backfilling.

CREATE TABLE IF NOT EXISTS verification_token (
    identifier TEXT NOT NULL,
    expires TIMESTAMPTZ NOT NULL,
    token TEXT NOT NULL,
    PRIMARY KEY (identifier, token)
);

CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL,
    "userId" INTEGER NOT NULL,
    type VARCHAR(255) NOT NULL,
    provider VARCHAR(255) NOT NULL,
    "providerAccountId" VARCHAR(255) NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at BIGINT,
    id_token TEXT,
    scope TEXT,
    session_state TEXT,
    token_type TEXT,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL,
    "userId" INTEGER NOT NULL,
    expires TIMESTAMPTZ NOT NULL,
    "sessionToken" VARCHAR(255) NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL,
    name VARCHAR(255),
    email VARCHAR(255),
    "emailVerified" TIMESTAMPTZ,
    image TEXT,
    PRIMARY KEY (id)
);
