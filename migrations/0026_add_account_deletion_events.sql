-- Migration: Add account deletion event types to security_logs
-- Date: 2026-01-31
-- Purpose: Allow account_delete_student and account_delete_teacher event types in security_logs

-- SQLite doesn't support modifying CHECK constraints directly
-- We need to recreate the table with the new constraint

-- Step 1: Create new table with updated CHECK constraint
CREATE TABLE IF NOT EXISTS security_logs_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  user_id INTEGER,
  ip_address TEXT NOT NULL,
  details TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Updated CHECK constraint with account deletion events
  CHECK (event_type IN (
    'login_success', 
    'login_failure', 
    'logout', 
    'signup_success', 
    'student_signup_success', 
    'student_login_success', 
    'student_login_failure', 
    'password_change', 
    'session_expired', 
    'suspicious_activity',
    'account_delete_teacher',
    'account_delete_student'
  ))
);

-- Step 2: Copy existing data
INSERT INTO security_logs_new (id, event_type, user_id, ip_address, details, created_at)
SELECT id, event_type, user_id, ip_address, details, created_at
FROM security_logs;

-- Step 3: Drop old table
DROP TABLE security_logs;

-- Step 4: Rename new table
ALTER TABLE security_logs_new RENAME TO security_logs;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_security_logs_user_id ON security_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_ip_address ON security_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON security_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_security_logs_event_type ON security_logs(event_type);
