-- Add subscription column to users table
ALTER TABLE users ADD COLUMN subscription TEXT DEFAULT '무료';

-- Update existing users to have '무료' plan
UPDATE users SET subscription = '무료' WHERE subscription IS NULL;
