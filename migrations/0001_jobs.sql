CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  email TEXT,
  source_key TEXT,
  result_key TEXT,
  original_file_name TEXT,
  file_size INTEGER,
  estimated_pages INTEGER,
  row_count INTEGER DEFAULT 0,
  confidence REAL DEFAULT 0,
  error TEXT,
  paid_at TEXT,
  source_deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jobs_token_hash ON jobs(token_hash);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_expires_at ON jobs(expires_at);

CREATE TABLE IF NOT EXISTS rate_limits (
  id TEXT PRIMARY KEY,
  window_start TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at ON rate_limits(expires_at);
