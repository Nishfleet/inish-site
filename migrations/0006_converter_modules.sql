ALTER TABLE jobs ADD COLUMN converter_id TEXT DEFAULT 'bank';
ALTER TABLE jobs ADD COLUMN input_mime_type TEXT;

CREATE INDEX IF NOT EXISTS idx_jobs_converter_id ON jobs(converter_id, created_at);
