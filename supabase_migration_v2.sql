-- Cooperative Management System
-- Migration V2: App Settings + Employee ID Roster
-- Run this after supabase_migration.sql

---------------------------------------------------------
-- 1. APP SETTINGS KEY-VALUE STORE
---------------------------------------------------------

CREATE TABLE IF NOT EXISTS app_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed defaults
INSERT INTO app_settings (key, value, updated_at) VALUES
    ('app_name',        'Coop Management', NOW()),
    ('app_subtitle',    'Enterprise Core', NOW()),
    ('currency_symbol', '$',               NOW())
ON CONFLICT (key) DO NOTHING;

---------------------------------------------------------
-- 2. EMPLOYEE ID VERIFICATION
---------------------------------------------------------

-- Add verification flag to existing users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id_verified BOOLEAN NOT NULL DEFAULT TRUE;

-- Valid employee IDs roster (uploaded by System Admin)
CREATE TABLE IF NOT EXISTS valid_employee_ids (
    id                  SERIAL PRIMARY KEY,
    employee_id         TEXT NOT NULL UNIQUE,
    first_name          TEXT,
    middle_name         TEXT,
    last_name           TEXT,
    is_claimed          BOOLEAN NOT NULL DEFAULT FALSE,
    claimed_by_user_id  INTEGER REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

---------------------------------------------------------
-- 3. ROW LEVEL SECURITY
---------------------------------------------------------

ALTER TABLE app_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE valid_employee_ids ENABLE ROW LEVEL SECURITY;

-- App settings: public read (needed for unauthenticated branding fetch), admin write
CREATE POLICY read_app_settings
    ON app_settings FOR SELECT
    USING (TRUE);

CREATE POLICY admin_app_settings
    ON app_settings FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.uid = auth.uid()::text AND u.role = 'System Admin'
        )
    );

-- Valid employee IDs: authenticated read, admin write
CREATE POLICY read_valid_employee_ids
    ON valid_employee_ids FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY admin_valid_employee_ids
    ON valid_employee_ids FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.uid = auth.uid()::text AND u.role = 'System Admin'
        )
    );
