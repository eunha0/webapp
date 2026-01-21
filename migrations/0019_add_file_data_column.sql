-- Add file_data column to store base64 data when R2 is not available
ALTER TABLE uploaded_files ADD COLUMN file_data TEXT;
