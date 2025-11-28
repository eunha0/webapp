-- Add access_code column to assignments table
ALTER TABLE assignments ADD COLUMN access_code TEXT;

-- Create unique index for access_code (acts as UNIQUE constraint)
CREATE UNIQUE INDEX IF NOT EXISTS idx_assignments_access_code ON assignments(access_code);
