CREATE TABLE IF NOT EXISTS dodo_webhook_events (
  webhook_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  business_id TEXT,
  provider_object_id TEXT,
  status TEXT NOT NULL DEFAULT 'received',
  error TEXT,
  received_count INTEGER NOT NULL DEFAULT 1,
  first_received_at TEXT NOT NULL,
  last_received_at TEXT NOT NULL,
  processed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dodo_webhook_events_status ON dodo_webhook_events(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_dodo_webhook_events_type ON dodo_webhook_events(event_type, created_at);

CREATE TABLE IF NOT EXISTS dodo_payment_events (
  id TEXT PRIMARY KEY,
  provider_event_id TEXT,
  event_type TEXT,
  job_id TEXT,
  payment_id TEXT,
  checkout_session_id TEXT,
  product_id TEXT,
  plan_id TEXT,
  status TEXT,
  amount INTEGER DEFAULT 0,
  currency TEXT,
  business_id TEXT,
  matched_by TEXT,
  match_status TEXT,
  payload_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dodo_payment_events_job ON dodo_payment_events(job_id, created_at);
CREATE INDEX IF NOT EXISTS idx_dodo_payment_events_payment ON dodo_payment_events(payment_id, created_at);
CREATE INDEX IF NOT EXISTS idx_dodo_payment_events_provider_event ON dodo_payment_events(provider_event_id);
CREATE INDEX IF NOT EXISTS idx_dodo_payment_events_match ON dodo_payment_events(match_status, created_at);

CREATE TABLE IF NOT EXISTS dodo_refund_events (
  id TEXT PRIMARY KEY,
  provider_event_id TEXT,
  event_type TEXT,
  job_id TEXT,
  payment_id TEXT,
  refund_id TEXT,
  status TEXT,
  reason TEXT,
  amount INTEGER DEFAULT 0,
  currency TEXT,
  business_id TEXT,
  payload_hash TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dodo_refund_events_job ON dodo_refund_events(job_id, created_at);
CREATE INDEX IF NOT EXISTS idx_dodo_refund_events_payment ON dodo_refund_events(payment_id, created_at);
CREATE INDEX IF NOT EXISTS idx_dodo_refund_events_refund ON dodo_refund_events(refund_id);
CREATE INDEX IF NOT EXISTS idx_dodo_refund_events_status ON dodo_refund_events(status, created_at);

CREATE TABLE IF NOT EXISTS job_attempts (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  attempt_type TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_job_attempts_job ON job_attempts(job_id, created_at);
CREATE INDEX IF NOT EXISTS idx_job_attempts_type_status ON job_attempts(attempt_type, status, created_at);
