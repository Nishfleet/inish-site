ALTER TABLE jobs ADD COLUMN external_provider TEXT;
ALTER TABLE jobs ADD COLUMN external_job_id TEXT;
ALTER TABLE jobs ADD COLUMN external_task_id TEXT;
ALTER TABLE jobs ADD COLUMN external_status TEXT;
ALTER TABLE jobs ADD COLUMN external_result_name TEXT;
ALTER TABLE jobs ADD COLUMN external_result_url TEXT;
ALTER TABLE jobs ADD COLUMN external_updated_at TEXT;

CREATE INDEX IF NOT EXISTS idx_jobs_external_provider_job ON jobs(external_provider, external_job_id);
