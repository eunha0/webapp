-- File Uploads Table
-- Stores information about uploaded files (images and PDFs)

CREATE TABLE IF NOT EXISTS uploaded_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  student_user_id INTEGER,
  submission_id INTEGER,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK(file_type IN ('image', 'pdf')),
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  storage_key TEXT NOT NULL,      -- R2 storage key or local reference
  storage_url TEXT,                -- Public URL (R2 or local)
  extracted_text TEXT,             -- OCR/PDF extracted text
  processing_status TEXT DEFAULT 'pending' CHECK(processing_status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (student_user_id) REFERENCES student_users(id) ON DELETE CASCADE,
  FOREIGN KEY (submission_id) REFERENCES student_submissions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_uploaded_files_user ON uploaded_files(user_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_student ON uploaded_files(student_user_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_submission ON uploaded_files(submission_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_status ON uploaded_files(processing_status);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_type ON uploaded_files(file_type);

-- File Processing Log
-- Tracks detailed processing information for debugging
CREATE TABLE IF NOT EXISTS file_processing_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uploaded_file_id INTEGER NOT NULL,
  step TEXT NOT NULL,              -- 'upload', 'ocr', 'extraction', 'complete'
  status TEXT NOT NULL,             -- 'started', 'success', 'error'
  message TEXT,
  processing_time_ms INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaded_file_id) REFERENCES uploaded_files(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_processing_log_file ON file_processing_log(uploaded_file_id);
CREATE INDEX IF NOT EXISTS idx_processing_log_status ON file_processing_log(status);
