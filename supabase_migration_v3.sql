-- Cooperative Management System
-- Migration V3: Cooperative Terms Configuration
-- Run this after supabase_migration_v2.sql

---------------------------------------------------------
-- 1. MEMBERSHIP TYPES
-- e.g. Regular, Associate, Honorary
---------------------------------------------------------

CREATE TABLE IF NOT EXISTS membership_types (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO membership_types (name, sort_order) VALUES
    ('Regular',   1),
    ('Associate', 2),
    ('Honorary',  3)
ON CONFLICT (name) DO NOTHING;

---------------------------------------------------------
-- 2. MEMBERSHIP STATUSES
-- e.g. Active, Inactive, Suspended, Deceased
---------------------------------------------------------

CREATE TABLE IF NOT EXISTS membership_statuses (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO membership_statuses (name, sort_order) VALUES
    ('Active',    1),
    ('Inactive',  2),
    ('Suspended', 3),
    ('Deceased',  4)
ON CONFLICT (name) DO NOTHING;

---------------------------------------------------------
-- 3. SAVINGS PRODUCTS
-- interest_rate_bps: basis points — 250 = 2.50% p.a.
-- min_balance_cents: minimum maintaining balance in cents
---------------------------------------------------------

CREATE TABLE IF NOT EXISTS savings_products (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR(150) NOT NULL UNIQUE,
    description         TEXT,
    interest_rate_bps   INTEGER NOT NULL DEFAULT 0 CHECK (interest_rate_bps >= 0),
    min_balance_cents   INTEGER NOT NULL DEFAULT 0 CHECK (min_balance_cents >= 0),
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

---------------------------------------------------------
-- 4. LOAN PRODUCTS
-- interest_rate_bps: basis points per month — 100 = 1.00%/mo
-- min/max_amount_cents: loanable range in cents
---------------------------------------------------------

CREATE TABLE IF NOT EXISTS loan_products (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR(150) NOT NULL UNIQUE,
    description         TEXT,
    interest_rate_bps   INTEGER NOT NULL CHECK (interest_rate_bps >= 0),
    max_term_months     INTEGER NOT NULL CHECK (max_term_months > 0),
    min_amount_cents    INTEGER NOT NULL CHECK (min_amount_cents >= 0),
    max_amount_cents    INTEGER NOT NULL CHECK (max_amount_cents > 0),
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

---------------------------------------------------------
-- 5. LOAN APPROVAL MATRIX
-- Defines which role can approve up to max_amount_cents.
-- loan_product_id = NULL means the rule applies to all products.
---------------------------------------------------------

CREATE TABLE IF NOT EXISTS loan_approval_matrix (
    id                  SERIAL PRIMARY KEY,
    role                VARCHAR(100) NOT NULL,
    max_amount_cents    INTEGER NOT NULL CHECK (max_amount_cents > 0),
    loan_product_id     INTEGER REFERENCES loan_products(id) ON DELETE CASCADE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

---------------------------------------------------------
-- 6. DEPARTMENTS
---------------------------------------------------------

CREATE TABLE IF NOT EXISTS departments (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL UNIQUE,
    code        VARCHAR(20) NOT NULL UNIQUE,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

---------------------------------------------------------
-- 7. COOPERATIVE PARAMETERS (extends app_settings)
-- share_par_value_cents:           par value per share in cents
-- share_min/max_shares:            allowed share range per member
-- share_min_monthly_contrib_cents: required monthly contribution
-- loan_min_tenure_months:          membership tenure before loan eligibility
-- loan_savings_multiplier:         max loan = savings × multiplier
---------------------------------------------------------

INSERT INTO app_settings (key, value, updated_at) VALUES
    ('share_par_value_cents',           '10000', NOW()),
    ('share_min_shares',                '10',    NOW()),
    ('share_max_shares',                '1000',  NOW()),
    ('share_min_monthly_contrib_cents', '50000', NOW()),
    ('loan_min_tenure_months',          '6',     NOW()),
    ('loan_savings_multiplier',         '3',     NOW())
ON CONFLICT (key) DO NOTHING;

---------------------------------------------------------
-- 8. INDEXES
---------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_membership_types_sort    ON membership_types    (sort_order);
CREATE INDEX IF NOT EXISTS idx_membership_statuses_sort ON membership_statuses (sort_order);
CREATE INDEX IF NOT EXISTS idx_loan_approval_role       ON loan_approval_matrix (role);

---------------------------------------------------------
-- 9. ROW LEVEL SECURITY
---------------------------------------------------------

ALTER TABLE membership_types     ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_statuses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_products     ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_approval_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments          ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated user
CREATE POLICY read_membership_types
    ON membership_types FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY read_membership_statuses
    ON membership_statuses FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY read_savings_products
    ON savings_products FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY read_loan_products
    ON loan_products FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY read_loan_approval_matrix
    ON loan_approval_matrix FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY read_departments
    ON departments FOR SELECT
    USING (auth.role() = 'authenticated');

-- Write: System Admin only
CREATE POLICY admin_membership_types
    ON membership_types FOR ALL
    USING (EXISTS (SELECT 1 FROM users u WHERE u.uid = auth.uid()::text AND u.role = 'System Admin'));

CREATE POLICY admin_membership_statuses
    ON membership_statuses FOR ALL
    USING (EXISTS (SELECT 1 FROM users u WHERE u.uid = auth.uid()::text AND u.role = 'System Admin'));

CREATE POLICY admin_savings_products
    ON savings_products FOR ALL
    USING (EXISTS (SELECT 1 FROM users u WHERE u.uid = auth.uid()::text AND u.role = 'System Admin'));

CREATE POLICY admin_loan_products
    ON loan_products FOR ALL
    USING (EXISTS (SELECT 1 FROM users u WHERE u.uid = auth.uid()::text AND u.role = 'System Admin'));

CREATE POLICY admin_loan_approval_matrix
    ON loan_approval_matrix FOR ALL
    USING (EXISTS (SELECT 1 FROM users u WHERE u.uid = auth.uid()::text AND u.role = 'System Admin'));

CREATE POLICY admin_departments
    ON departments FOR ALL
    USING (EXISTS (SELECT 1 FROM users u WHERE u.uid = auth.uid()::text AND u.role = 'System Admin'));
