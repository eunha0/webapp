-- Migration: Fix email_verifications table to support both teachers and students
-- Date: 2026-01-31
-- Purpose: Make user_id nullable so student_user_id can be used instead

-- ============================================================================
-- 1. Create new email_verifications table with nullable user_id
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_verifications_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,  -- Made nullable for student support
  student_user_id INTEGER,  -- For student verifications
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  verified BOOLEAN DEFAULT FALSE,
  expires_at DATETIME NOT NULL,
  verified_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (student_user_id) REFERENCES student_users(id) ON DELETE CASCADE,
  
  -- Ensure at least one ID is provided
  CHECK ((user_id IS NOT NULL AND student_user_id IS NULL) OR (user_id IS NULL AND student_user_id IS NOT NULL))
);

-- ============================================================================
-- 2. Copy data from old table
-- ============================================================================
INSERT INTO email_verifications_new (id, user_id, email, token, verified, expires_at, verified_at, created_at)
SELECT id, user_id, email, token, verified, expires_at, verified_at, created_at
FROM email_verifications;

-- ============================================================================
-- 3. Drop old table and rename new one
-- ============================================================================
DROP TABLE email_verifications;
ALTER TABLE email_verifications_new RENAME TO email_verifications;

-- ============================================================================
-- 4. Recreate indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user_id ON email_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verifications_student_user_id ON email_verifications(student_user_id);
CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email);
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires_at ON email_verifications(expires_at);
