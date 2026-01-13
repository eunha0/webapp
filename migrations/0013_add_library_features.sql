-- Migration: Add library and subject columns to assignments table
-- This enables assignment library functionality with subject classification

-- Add is_library column to track if assignment is in library
ALTER TABLE assignments ADD COLUMN is_library BOOLEAN DEFAULT 0;

-- Add subject column for subject classification
ALTER TABLE assignments ADD COLUMN subject TEXT DEFAULT NULL;

-- Add library_registered_at timestamp
ALTER TABLE assignments ADD COLUMN library_registered_at DATETIME DEFAULT NULL;

-- Create index for library queries
CREATE INDEX IF NOT EXISTS idx_assignments_library ON assignments(is_library, subject);
