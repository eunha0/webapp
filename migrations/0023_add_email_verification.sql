-- Migration: Add email verification system
-- Date: 2026-01-28
-- Purpose: Add email verification for signup security and prevent fake email addresses

-- ============================================================================
-- 1. Create email_verifications table
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_verifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  verified BOOLEAN DEFAULT FALSE,
  expires_at DATETIME NOT NULL,
  verified_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user_id ON email_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email);
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires_at ON email_verifications(expires_at);

-- ============================================================================
-- 2. Add email_verified column to users table
-- ============================================================================
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- 3. Update security_logs CHECK constraint to include email_verification events
-- ============================================================================
-- Note: SQLite doesn't support modifying CHECK constraints directly
-- We'll document that 'email_verification_sent' and 'email_verification_success' 
-- should be added to the allowed event types in future schema updates

-- For now, we'll use existing event types:
-- - 'signup_success' for email verification sent
-- - 'login_success' for email verification completed

-- ============================================================================
-- 4. Add password_reset_attempt_notifications table
-- ============================================================================
CREATE TABLE IF NOT EXISTS password_reset_attempt_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  success BOOLEAN DEFAULT FALSE,
  notified BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_password_reset_notifications_user_id ON password_reset_attempt_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_notifications_created_at ON password_reset_attempt_notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_notifications_notified ON password_reset_attempt_notifications(notified);
