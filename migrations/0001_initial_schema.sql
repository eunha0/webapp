-- Grading Sessions table
-- Stores information about each grading session
CREATE TABLE IF NOT EXISTS grading_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_prompt TEXT NOT NULL,
  grade_level TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Rubric Criteria table
-- Stores the rubric criteria for each grading session
CREATE TABLE IF NOT EXISTS rubric_criteria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  criterion_name TEXT NOT NULL,
  criterion_description TEXT NOT NULL,
  criterion_order INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES grading_sessions(id) ON DELETE CASCADE
);

-- Essays table
-- Stores student essays to be graded
CREATE TABLE IF NOT EXISTS essays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  essay_text TEXT NOT NULL,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES grading_sessions(id) ON DELETE CASCADE
);

-- Grading Results table
-- Stores the overall grading results
CREATE TABLE IF NOT EXISTS grading_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  essay_id INTEGER NOT NULL UNIQUE,
  total_score REAL NOT NULL,
  summary_evaluation TEXT NOT NULL,
  overall_comment TEXT NOT NULL,
  revision_suggestions TEXT NOT NULL,
  next_steps_advice TEXT NOT NULL,
  graded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (essay_id) REFERENCES essays(id) ON DELETE CASCADE
);

-- Criterion Scores table
-- Stores detailed scores for each rubric criterion
CREATE TABLE IF NOT EXISTS criterion_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  result_id INTEGER NOT NULL,
  criterion_id INTEGER NOT NULL,
  score INTEGER NOT NULL CHECK(score >= 1 AND score <= 4),
  strengths TEXT NOT NULL,
  areas_for_improvement TEXT NOT NULL,
  FOREIGN KEY (result_id) REFERENCES grading_results(id) ON DELETE CASCADE,
  FOREIGN KEY (criterion_id) REFERENCES rubric_criteria(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_rubric_criteria_session ON rubric_criteria(session_id);
CREATE INDEX IF NOT EXISTS idx_essays_session ON essays(session_id);
CREATE INDEX IF NOT EXISTS idx_grading_results_essay ON grading_results(essay_id);
CREATE INDEX IF NOT EXISTS idx_criterion_scores_result ON criterion_scores(result_id);
CREATE INDEX IF NOT EXISTS idx_criterion_scores_criterion ON criterion_scores(criterion_id);
