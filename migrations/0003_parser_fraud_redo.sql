ALTER TABLE jobs ADD COLUMN file_hash TEXT;
ALTER TABLE jobs ADD COLUMN ip_hash TEXT;
ALTER TABLE jobs ADD COLUMN user_agent_hash TEXT;
ALTER TABLE jobs ADD COLUMN redo_count INTEGER DEFAULT 0;
ALTER TABLE jobs ADD COLUMN last_redo_at TEXT;
ALTER TABLE jobs ADD COLUMN refund_status TEXT;
ALTER TABLE jobs ADD COLUMN refund_id TEXT;
ALTER TABLE jobs ADD COLUMN refund_requested_at TEXT;
ALTER TABLE jobs ADD COLUMN download_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_jobs_file_hash ON jobs(file_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_payment_id_unique ON jobs(payment_id);

CREATE TABLE IF NOT EXISTS abuse_events (
  id TEXT PRIMARY KEY,
  ip_hash TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  event_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_abuse_events_ip ON abuse_events(ip_hash, event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_abuse_events_file ON abuse_events(file_hash, event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_abuse_events_expires ON abuse_events(expires_at);
