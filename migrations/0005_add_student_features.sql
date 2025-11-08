-- Student accounts and authentication
CREATE TABLE IF NOT EXISTS student_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  grade_level TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Student sessions
CREATE TABLE IF NOT EXISTS student_sessions (
  id TEXT PRIMARY KEY,
  student_id INTEGER NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES student_users(id) ON DELETE CASCADE
);

-- Assignment access codes for students
CREATE TABLE IF NOT EXISTS assignment_access_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL,
  access_code TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
);

-- Enhanced student submissions - recreate with new columns
-- Drop old table and recreate (data migration handled separately if needed)
DROP TABLE IF EXISTS student_submissions_new;

CREATE TABLE student_submissions_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL,
  student_name TEXT NOT NULL,
  student_user_id INTEGER, -- NEW: Link to student account
  essay_text TEXT NOT NULL,
  file_url TEXT,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  graded BOOLEAN DEFAULT 0,
  grade_result_id INTEGER,
  submission_version INTEGER DEFAULT 1, -- NEW: Track resubmissions
  is_resubmission BOOLEAN DEFAULT 0, -- NEW: Flag for resubmissions
  previous_submission_id INTEGER, -- NEW: Link to previous version
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (student_user_id) REFERENCES student_users(id),
  FOREIGN KEY (previous_submission_id) REFERENCES student_submissions_new(id)
);

-- Copy existing data
INSERT INTO student_submissions_new 
  (id, assignment_id, student_name, essay_text, file_url, submitted_at, graded, grade_result_id)
SELECT id, assignment_id, student_name, essay_text, file_url, submitted_at, graded, grade_result_id
FROM student_submissions;

-- Replace old table
DROP TABLE student_submissions;
ALTER TABLE student_submissions_new RENAME TO student_submissions;

-- Detailed feedback per criterion
CREATE TABLE IF NOT EXISTS submission_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL,
  criterion_id INTEGER NOT NULL,
  score INTEGER NOT NULL CHECK(score >= 1 AND score <= 4),
  positive_feedback TEXT NOT NULL,
  improvement_areas TEXT NOT NULL,
  specific_suggestions TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES student_submissions(id) ON DELETE CASCADE,
  FOREIGN KEY (criterion_id) REFERENCES assignment_rubrics(id)
);

-- Overall submission feedback
CREATE TABLE IF NOT EXISTS submission_summary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL UNIQUE,
  total_score REAL NOT NULL,
  strengths TEXT NOT NULL,
  weaknesses TEXT NOT NULL,
  overall_comment TEXT NOT NULL,
  improvement_priority TEXT,
  teacher_adjusted BOOLEAN DEFAULT 0,
  teacher_comment TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES student_submissions(id) ON DELETE CASCADE
);

-- Student progress tracking
CREATE TABLE IF NOT EXISTS student_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_user_id INTEGER NOT NULL,
  assignment_id INTEGER NOT NULL,
  submission_count INTEGER DEFAULT 0,
  best_score REAL,
  latest_score REAL,
  improvement_rate REAL,
  tracked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_user_id) REFERENCES student_users(id) ON DELETE CASCADE,
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
);

-- Learning resources recommendations
CREATE TABLE IF NOT EXISTS learning_resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL, -- 'logic', 'evidence', 'structure', 'language'
  grade_level TEXT NOT NULL,
  url TEXT,
  content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Student resource recommendations (personalized)
CREATE TABLE IF NOT EXISTS student_resource_recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_user_id INTEGER NOT NULL,
  resource_id INTEGER NOT NULL,
  based_on_submission_id INTEGER,
  reason TEXT NOT NULL,
  completed BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_user_id) REFERENCES student_users(id) ON DELETE CASCADE,
  FOREIGN KEY (resource_id) REFERENCES learning_resources(id),
  FOREIGN KEY (based_on_submission_id) REFERENCES student_submissions(id)
);

-- Teacher statistics and analytics
CREATE TABLE IF NOT EXISTS teacher_statistics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  assignment_id INTEGER,
  total_submissions INTEGER DEFAULT 0,
  avg_score REAL,
  time_saved_minutes INTEGER DEFAULT 0,
  common_strengths TEXT,
  common_weaknesses TEXT,
  calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_student_sessions_student ON student_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_student_submissions_student ON student_submissions(student_user_id);
CREATE INDEX IF NOT EXISTS idx_submission_feedback_submission ON submission_feedback(submission_id);
CREATE INDEX IF NOT EXISTS idx_student_progress_student ON student_progress(student_user_id);
CREATE INDEX IF NOT EXISTS idx_assignment_access_codes_code ON assignment_access_codes(access_code);
