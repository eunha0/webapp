-- Assignments table for teachers to manage essay assignments
CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  grade_level TEXT NOT NULL,
  due_date DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Assignment rubrics table
CREATE TABLE IF NOT EXISTS assignment_rubrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL,
  criterion_name TEXT NOT NULL,
  criterion_description TEXT NOT NULL,
  criterion_order INTEGER NOT NULL,
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
);

-- Student submissions table
CREATE TABLE IF NOT EXISTS student_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL,
  student_name TEXT NOT NULL,
  essay_text TEXT NOT NULL,
  file_url TEXT,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  graded BOOLEAN DEFAULT 0,
  grade_result_id INTEGER,
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_assignments_user_id ON assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_assignment_rubrics_assignment_id ON assignment_rubrics(assignment_id);
CREATE INDEX IF NOT EXISTS idx_student_submissions_assignment_id ON student_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_student_submissions_graded ON student_submissions(graded);
