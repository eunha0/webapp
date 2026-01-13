-- Add usage count and average rating to assignments table
ALTER TABLE assignments ADD COLUMN usage_count INTEGER DEFAULT 0;
ALTER TABLE assignments ADD COLUMN average_rating REAL DEFAULT 0;
ALTER TABLE assignments ADD COLUMN rating_count INTEGER DEFAULT 0;

-- Create assignment_ratings table for storing user ratings and reviews
CREATE TABLE IF NOT EXISTS assignment_ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(assignment_id, user_id)
);

-- Create assignment_tags table for tagging assignments
CREATE TABLE IF NOT EXISTS assignment_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL,
  tag TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_assignment_ratings_assignment_id ON assignment_ratings(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_ratings_user_id ON assignment_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_assignment_tags_assignment_id ON assignment_tags(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_tags_tag ON assignment_tags(tag);
CREATE INDEX IF NOT EXISTS idx_assignments_usage_count ON assignments(usage_count);
CREATE INDEX IF NOT EXISTS idx_assignments_average_rating ON assignments(average_rating);
