-- Migration: Add grading-related columns to student_submissions
-- Date: 2024-12-16
-- Description: Add columns for storing grading results and feedback

-- Add status column for submission workflow
ALTER TABLE student_submissions ADD COLUMN status TEXT DEFAULT 'pending' 
  CHECK(status IN ('pending', 'grading', 'graded', 'failed'));

-- Add overall_score for numeric grade (0-100)
ALTER TABLE student_submissions ADD COLUMN overall_score INTEGER;

-- Add overall_feedback for general comments
ALTER TABLE student_submissions ADD COLUMN overall_feedback TEXT;

-- Add grading_result for storing full grading JSON
ALTER TABLE student_submissions ADD COLUMN grading_result TEXT;

-- Add graded_at timestamp
ALTER TABLE student_submissions ADD COLUMN graded_at DATETIME;

-- Create index for faster queries by status
CREATE INDEX IF NOT EXISTS idx_submissions_status ON student_submissions(status);

-- Create index for faster queries by graded status
CREATE INDEX IF NOT EXISTS idx_submissions_graded ON student_submissions(graded, graded_at);
