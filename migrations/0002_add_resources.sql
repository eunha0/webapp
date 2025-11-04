-- Resource posts table for CMS
CREATE TABLE IF NOT EXISTS resource_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL, -- 'rubric' or 'evaluation'
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index on category for faster queries
CREATE INDEX IF NOT EXISTS idx_resource_posts_category ON resource_posts(category);
CREATE INDEX IF NOT EXISTS idx_resource_posts_created_at ON resource_posts(created_at DESC);
