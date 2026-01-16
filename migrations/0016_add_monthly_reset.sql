-- Add monthly reset tracking column to users table
ALTER TABLE users ADD COLUMN last_reset_date TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN monthly_graded_count INTEGER DEFAULT 0;

-- Initialize last_reset_date for existing users
UPDATE users SET last_reset_date = date('now') WHERE last_reset_date IS NULL;

-- Create index for efficient reset queries
CREATE INDEX IF NOT EXISTS idx_users_last_reset ON users(last_reset_date);
