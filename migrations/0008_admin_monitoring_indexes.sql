CREATE INDEX IF NOT EXISTS idx_jobs_checkout_session ON jobs(checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_jobs_refund_status_updated ON jobs(refund_status, updated_at);
CREATE INDEX IF NOT EXISTS idx_jobs_paid_updated ON jobs(paid_at, updated_at);
CREATE INDEX IF NOT EXISTS idx_jobs_provider_status_updated ON jobs(external_provider, status, updated_at);
