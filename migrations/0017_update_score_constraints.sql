-- Remove score constraint from criterion_scores to support 100-point rubrics
-- SQLite doesn't support ALTER TABLE to modify CHECK constraints
-- So we need to recreate the table

-- Step 1: Create new table without score constraint
CREATE TABLE criterion_scores_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  result_id INTEGER NOT NULL,
  criterion_id INTEGER NOT NULL,
  score INTEGER NOT NULL CHECK(score >= 0 AND score <= 100),
  strengths TEXT NOT NULL,
  areas_for_improvement TEXT NOT NULL,
  FOREIGN KEY (result_id) REFERENCES grading_results(id) ON DELETE CASCADE,
  FOREIGN KEY (criterion_id) REFERENCES rubric_criteria(id) ON DELETE CASCADE
);

-- Step 2: Copy existing data
INSERT INTO criterion_scores_new (id, result_id, criterion_id, score, strengths, areas_for_improvement)
SELECT id, result_id, criterion_id, score, strengths, areas_for_improvement
FROM criterion_scores;

-- Step 3: Drop old table
DROP TABLE criterion_scores;

-- Step 4: Rename new table
ALTER TABLE criterion_scores_new RENAME TO criterion_scores;

-- Note: This migration changes the score constraint from (1-4) to (0-100)
-- to support both 4-point and 100-point rubric scales
