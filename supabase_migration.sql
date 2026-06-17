-- Cooperative Management System
-- Supabase PostgreSQL Migration & RLS Security Script

-- Enable UUID extension just in case it is needed for other schemas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

---------------------------------------------------------
-- 1. CLEAN RECREATION BLOCK (IF APPLICABLE)
---------------------------------------------------------
-- DROP TABLE IF EXISTS audit_logs CASCADE;
-- DROP TABLE IF EXISTS journal_entry_lines CASCADE;
-- DROP TABLE IF EXISTS journal_entries CASCADE;
-- DROP TABLE IF EXISTS transactions CASCADE;
-- DROP TABLE IF EXISTS chart_of_accounts CASCADE;
-- DROP TABLE IF EXISTS members CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

---------------------------------------------------------
-- 2. SCHEMATIC TABLES CREATION
---------------------------------------------------------

-- Users Table: Matches Supabase Auth.users or can handle federated/mock logins representing system seats.
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    uid VARCHAR(255) NOT NULL UNIQUE, -- Identifies Supabase/Firebase authentication UID
    email VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255),
    role VARCHAR(50) NOT NULL CHECK (role IN ('System Admin', 'Manager', 'Accounting Officer', 'Cashier', 'Auditor', 'Member')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Members Table: Directory of cooperative employee members.
CREATE TABLE IF NOT EXISTS members (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Connects to user seat if self-service login is granted
    employee_id VARCHAR(100) NOT NULL UNIQUE CHECK (employee_id <> ''),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(50),
    department VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Chart of Accounts: Immutable system ledgers classification
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    code VARCHAR(50) PRIMARY KEY, -- e.g., '1010' for cash asset, '2010' for savings liability, '3010' for share capital equity
    name VARCHAR(150) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
    normal_balance VARCHAR(10) NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
    description TEXT
);

-- Transactions Module: Stores initiation record details (deposits, capital logs, or manual adjustments).
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    member_id INTEGER REFERENCES members(id) ON DELETE CASCADE NOT NULL,
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'share_capital_contribution', 'reversal', 'manual_adjustment')),
    amount INTEGER NOT NULL CHECK (amount > 0), -- Stored as CENTS integer (positive values only) to prevent floating-point mismatch
    status VARCHAR(50) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'reversed')),
    reference_number VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_by INTEGER REFERENCES users(id) NOT NULL, -- Keep record of Teller/Operator UID
    reversing_transaction_id INTEGER, -- Self-reference loop if this transaction is reversing or has been reversed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Journal Entries: Double-entry header summaries
CREATE TABLE IF NOT EXISTS journal_entries (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER REFERENCES transactions(id) ON DELETE CASCADE, -- Nullable for standard manual adjusted journal listings
    description TEXT NOT NULL,
    entry_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Journal Entry Lines: Double-entry credits and debits rows mapping ledger impact.
CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id SERIAL PRIMARY KEY,
    journal_entry_id INTEGER REFERENCES journal_entries(id) ON DELETE CASCADE NOT NULL,
    coa_code VARCHAR(50) REFERENCES chart_of_accounts(code) ON DELETE RESTRICT NOT NULL,
    member_id INTEGER REFERENCES members(id) ON DELETE SET NULL, -- Null if general operating bank line, populated for subsidiary ledgers
    entry_type VARCHAR(10) NOT NULL CHECK (entry_type IN ('debit', 'credit')),
    amount INTEGER NOT NULL CHECK (amount > 0) -- Value in cents (positive value only)
);

-- Audit logs trace
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

---------------------------------------------------------
-- 3. SPEED OPTIMIZED INDEXING FOR LARGE TRANS_LEDGERS
---------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_coa ON journal_entry_lines(coa_code);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_member ON journal_entry_lines(member_id);
CREATE INDEX IF NOT EXISTS idx_transactions_member ON transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_tx ON journal_entries(transaction_id);

---------------------------------------------------------
-- 4. CHART OF ACCOUNTS STRUCTURAL SEED DATA
---------------------------------------------------------
INSERT INTO chart_of_accounts (code, name, type, normal_balance, description) VALUES
('1010', 'Cash on Hand & Bank', 'asset', 'debit', 'Cooperative primary operating cash in bank or cashier drawer'),
('2010', 'Member Savings Liability', 'liability', 'credit', 'Deposits, withdrawable balances, and savings held for members'),
('3010', 'Member Share Capital Equity', 'equity', 'credit', 'Paid-up membership capital and equity contributions')
ON CONFLICT (code) DO NOTHING;

---------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) ACTIVATION
---------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

---------------------------------------------------------
-- 6. POLICIES GENERATION (ROLE BASED ACCESS CONTROL)
---------------------------------------------------------

-- A. USERS Table Policies:
-- 1. Users can read their own profile row.
CREATE POLICY select_own_user ON users
    FOR SELECT
    USING (auth.uid()::text = uid);

-- 2. Staff members (Admin, Manager, Accountant, Auditor, Cashier) can see all users.
CREATE POLICY select_all_users_staff ON users
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.uid = auth.uid()::text 
              AND u.role IN ('System Admin', 'Manager', 'Accounting Officer', 'Cashier', 'Auditor')
        )
    );

-- 3. Only System Admin can write/update user profiles.
CREATE POLICY modify_users_admin ON users
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.uid = auth.uid()::text AND u.role = 'System Admin'
        )
    );

-- B. MEMBERS Table Policies:
-- 1. All staff can view member details.
CREATE POLICY view_members_staff ON members
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.uid = auth.uid()::text 
              AND u.role IN ('System Admin', 'Manager', 'Accounting Officer', 'Cashier', 'Auditor')
        )
    );

-- 2. Members can view only their own member profile line.
CREATE POLICY view_own_member ON members
    FOR SELECT
    USING (
        id IN (
            SELECT m.id FROM members m
            INNER JOIN users u ON m.user_id = u.id
            WHERE u.uid = auth.uid()::text
        )
    );

-- 3. Staff can create or modify member listings (except Auditor/Member).
CREATE POLICY modify_members_staff ON members
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.uid = auth.uid()::text 
              AND u.role IN ('System Admin', 'Manager', 'Accounting Officer', 'Cashier')
        )
    );

-- C. CHART OF ACCOUNTS:
-- 1. Read-only access for any authenticated users.
CREATE POLICY read_coa_all ON chart_of_accounts
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- 2. Write-only for Admin, Manager and Accountants.
CREATE POLICY modify_coa_admin ON chart_of_accounts
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.uid = auth.uid()::text AND u.role IN ('System Admin', 'Manager', 'Accounting Officer')
        )
    );

-- D. TRANSACTIONS / JOURNAL ENTRIES / LINES Policies:
-- 1. Staff can read all transactions and general ledgers.
CREATE POLICY read_transactions_staff ON transactions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.uid = auth.uid()::text 
              AND u.role IN ('System Admin', 'Manager', 'Accounting Officer', 'Cashier', 'Auditor')
        )
    );

-- 2. Members can view only transactions attributed to them.
CREATE POLICY read_own_transactions ON transactions
    FOR SELECT
    USING (
        member_id IN (
            SELECT m.id FROM members m
            INNER JOIN users u ON m.user_id = u.id
            WHERE u.uid = auth.uid()::text
        )
    );

-- 3. Cashiers, Accountants, Managers, and Admins can post transaction entries.
CREATE POLICY post_transactions_staff ON transactions
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.uid = auth.uid()::text 
              AND u.role IN ('System Admin', 'Manager', 'Accounting Officer', 'Cashier')
        )
    );

-- Journal Entries RLS policies (align with transactions visibility)
CREATE POLICY read_journal_staff ON journal_entries
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.uid = auth.uid()::text 
              AND u.role IN ('System Admin', 'Manager', 'Accounting Officer', 'Cashier', 'Auditor')
        )
    );

CREATE POLICY read_own_journal ON journal_entries
    FOR SELECT
    USING (
        transaction_id IN (
            SELECT t.id FROM transactions t
            INNER JOIN members m ON t.member_id = m.id
            INNER JOIN users u ON m.user_id = u.id
            WHERE u.uid = auth.uid()::text
        )
    );

CREATE POLICY post_journal_staff ON journal_entries
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.uid = auth.uid()::text 
              AND u.role IN ('System Admin', 'Manager', 'Accounting Officer', 'Cashier')
        )
    );

-- Journal Entry Lines RLS policies
CREATE POLICY read_journal_lines_staff ON journal_entry_lines
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.uid = auth.uid()::text 
              AND u.role IN ('System Admin', 'Manager', 'Accounting Officer', 'Cashier', 'Auditor')
        )
    );

CREATE POLICY read_own_journal_lines ON journal_entry_lines
    FOR SELECT
    USING (
        member_id IN (
            SELECT m.id FROM members m
            INNER JOIN users u ON m.user_id = u.id
            WHERE u.uid = auth.uid()::text
        )
    );

CREATE POLICY post_journal_lines_staff ON journal_entry_lines
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.uid = auth.uid()::text 
              AND u.role IN ('System Admin', 'Manager', 'Accounting Officer', 'Cashier')
        )
    );

-- E. AUDIT LOGS access:
-- 1. Full visibility for System Admins, Managers, and Auditors.
CREATE POLICY read_audit_logs_authorized ON audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.uid = auth.uid()::text 
              AND u.role IN ('System Admin', 'Manager', 'Auditor')
        )
    );

-- 2. Insertion permitted for any authenticated user actions (to trace active errors or system overrides).
CREATE POLICY create_audit_logs_unlimited ON audit_logs
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

