-- Migration: Create tables previously in Supabase, now in Linode Postgres
-- Run: psql -h 66.228.61.170 -p 5432 -U bheng -d bheng_local -f migrations/004_migrate_supabase_tables.sql

-- 1. INTEGRATIONS
CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    active BOOLEAN NOT NULL DEFAULT true,
    trigger TEXT,
    condition JSONB,
    config JSONB,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. SHARED_NOTES
CREATE TABLE IF NOT EXISTS shared_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    color TEXT,
    folder_name TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shared_notes_token ON shared_notes(token);

-- 3. AUTOMATIONS
CREATE TABLE IF NOT EXISTS automations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT '',
    trigger_type TEXT,
    trigger_integration_id UUID REFERENCES integrations(id) ON DELETE SET NULL,
    condition JSONB,
    action_type TEXT,
    action_integration_id UUID REFERENCES integrations(id) ON DELETE SET NULL,
    action_config JSONB,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. AUTOMATION_LOGS
CREATE TABLE IF NOT EXISTS automation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id UUID REFERENCES automations(id) ON DELETE CASCADE,
    automation_name TEXT,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    result TEXT,
    detail TEXT,
    via TEXT,
    trigger_payload JSONB
);
CREATE INDEX IF NOT EXISTS idx_automation_logs_automation_id ON automation_logs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_triggered_at ON automation_logs(triggered_at DESC);

-- 5. PUSH_SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint TEXT NOT NULL UNIQUE,
    keys JSONB NOT NULL,
    user_id UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);
