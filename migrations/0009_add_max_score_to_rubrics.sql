-- Add max_score column to assignment_rubrics table
ALTER TABLE assignment_rubrics ADD COLUMN max_score INTEGER DEFAULT 4;
