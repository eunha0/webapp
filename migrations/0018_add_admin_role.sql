-- Add admin role to users table
ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0;

-- Set the admin user
-- Note: This will be set manually or through secure admin setup
