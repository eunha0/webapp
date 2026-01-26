-- Add grading_history table to track all grading executions including re-gradings
CREATE TABLE IF NOT EXISTS grading_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL,
  assignment_id INTEGER NOT NULL,
  student_name TEXT NOT NULL,
  grade_level TEXT,
  overall_score INTEGER,
  max_score INTEGER DEFAULT 100,
  graded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  graded_by INTEGER NOT NULL,
  FOREIGN KEY (submission_id) REFERENCES student_submissions(id) ON DELETE CASCADE,
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_grading_history_graded_by ON grading_history(graded_by);
CREATE INDEX IF NOT EXISTS idx_grading_history_graded_at ON grading_history(graded_at);
CREATE INDEX IF NOT EXISTS idx_grading_history_submission ON grading_history(submission_id);
