-- Migration: Add email verification for student users
-- Date: 2026-01-30
-- Purpose: Add email verification system for student signup

-- ============================================================================
-- 1. Add email_verified column to student_users table
-- ============================================================================
ALTER TABLE student_users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- 2. Update email_verifications table to support student users
-- ============================================================================
-- Add student_user_id column (nullable because existing rows are for teachers)
ALTER TABLE email_verifications ADD COLUMN student_user_id INTEGER;

-- Add foreign key constraint (conceptually - SQLite doesn't enforce via ALTER)
-- FOREIGN KEY (student_user_id) REFERENCES student_users(id) ON DELETE CASCADE

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_email_verifications_student_user_id ON email_verifications(student_user_id);

-- ============================================================================
-- 3. Set all existing student accounts to verified (backward compatibility)
-- ============================================================================
UPDATE student_users SET email_verified = TRUE WHERE email_verified IS NULL OR email_verified = FALSE;
