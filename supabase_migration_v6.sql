-- Migration v6: Add avatar_url and phone to users table
-- Run this in your Supabase SQL editor

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
