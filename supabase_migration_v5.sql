-- Cooperative Management System
-- Migration V5: Employee ID at Registration
-- Run this after supabase_migration_v4.sql

-- Store the employee ID provided at registration time so the admin can
-- identify the person immediately. Cleared after approval.
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_employee_id TEXT;
