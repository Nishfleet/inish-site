ALTER TABLE jobs ADD COLUMN batch_id TEXT;

CREATE TABLE IF NOT EXISTS batch_checkouts (
  id TEXT PRIMARY KEY,
  checkout_session_id TEXT,
  payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'created',
  plan_id TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  currency TEXT,
  job_count INTEGER NOT NULL DEFAULT 0,
  job_ids_json TEXT,
  email TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  paid_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_jobs_batch_id ON jobs(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_checkouts_session ON batch_checkouts(checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_batch_checkouts_payment ON batch_checkouts(payment_id);
CREATE INDEX IF NOT EXISTS idx_batch_checkouts_status ON batch_checkouts(status, updated_at);
