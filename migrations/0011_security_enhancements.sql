-- Migration: Security Enhancements for Authentication System
-- Date: 2025-12-15
-- Purpose: Add security logging, session tracking, and enhanced authentication

-- ============================================================================
-- 1. Create security_logs table for audit trail
-- ============================================================================
CREATE TABLE IF NOT EXISTS security_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,  -- login_success, login_failure, logout, signup_success, password_change, etc.
  user_id INTEGER,           -- NULL for failed login attempts
  ip_address TEXT NOT NULL,
  details TEXT,              -- JSON string with additional details
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Add index for performance
  CHECK (event_type IN ('login_success', 'login_failure', 'logout', 'signup_success', 'student_signup_success', 'student_login_success', 'student_login_failure', 'password_change', 'session_expired', 'suspicious_activity'))
);

CREATE INDEX IF NOT EXISTS idx_security_logs_user_id ON security_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_ip_address ON security_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON security_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_security_logs_event_type ON security_logs(event_type);

-- ============================================================================
-- 2. Add security columns to sessions table (if not exists)
-- ============================================================================
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE,
-- so we need to check if columns exist first

-- Add ip_address column to sessions
ALTER TABLE sessions ADD COLUMN ip_address TEXT;

-- Add user_agent column to sessions
ALTER TABLE sessions ADD COLUMN user_agent TEXT;

-- Add created_at column to sessions
ALTER TABLE sessions ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;

-- Add last_activity column to sessions (for automatic renewal)
ALTER TABLE sessions ADD COLUMN last_activity DATETIME DEFAULT CURRENT_TIMESTAMP;

-- ============================================================================
-- 3. Add security columns to student_sessions table
-- ============================================================================
ALTER TABLE student_sessions ADD COLUMN ip_address TEXT;
ALTER TABLE student_sessions ADD COLUMN user_agent TEXT;
ALTER TABLE student_sessions ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE student_sessions ADD COLUMN last_activity DATETIME DEFAULT CURRENT_TIMESTAMP;

-- ============================================================================
-- 4. Create rate limiting table (alternative to Redis for small scale)
-- ============================================================================
CREATE TABLE IF NOT EXISTS rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL,  -- IP address or user ID
  endpoint TEXT NOT NULL,    -- API endpoint
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(identifier, endpoint, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits(identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits(window_start);

-- ============================================================================
-- 5. Create password_reset_tokens table (for future password reset feature)
-- ============================================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- ============================================================================
-- 6. Create failed_login_attempts table (for account lockout)
-- ============================================================================
CREATE TABLE IF NOT EXISTS failed_login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  locked_until DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(email, ip_address)
);

CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_email ON failed_login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_locked_until ON failed_login_attempts(locked_until);

-- ============================================================================
-- 7. Add indexes to existing tables for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_student_sessions_expires_at ON student_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_student_sessions_student_id ON student_sessions(student_id);

-- ============================================================================
-- 8. Add comments (SQLite 3.37+)
-- ============================================================================
-- Note: SQLite doesn't support COMMENT ON TABLE, so we document here:
-- security_logs: Audit trail for all authentication and security events
-- rate_limits: Simple rate limiting without Redis (for small scale)
-- password_reset_tokens: Tokens for password reset functionality
-- failed_login_attempts: Track failed logins for account lockout
