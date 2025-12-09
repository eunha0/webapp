-- Add revision_suggestions and next_steps_advice to submission_summary table
ALTER TABLE submission_summary ADD COLUMN revision_suggestions TEXT;
ALTER TABLE submission_summary ADD COLUMN next_steps_advice TEXT;
