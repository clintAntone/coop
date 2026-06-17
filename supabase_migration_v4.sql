-- Cooperative Management System
-- Migration V4: Missing Constraints & Pre-Registration Support
-- Run this after supabase_migration_v3.sql

---------------------------------------------------------
-- 1. ENSURE UNIQUE CONSTRAINTS EXIST ON USERS TABLE
--    (May be missing if the table was created without them)
---------------------------------------------------------

DO $$
BEGIN
  -- uid unique constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'users'::regclass AND contype = 'u'
      AND conname = 'users_uid_key'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_uid_key UNIQUE (uid);
  END IF;

  -- email unique constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'users'::regclass AND contype = 'u'
      AND conname = 'users_email_key'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
  END IF;
END
$$;
