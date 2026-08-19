CREATE TABLE IF NOT EXISTS preview_funnel_events (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  job_id TEXT,
  event_type TEXT NOT NULL,
  converter_id TEXT,
  output_format TEXT,
  input_kind TEXT,
  file_size_bucket TEXT,
  page_bucket TEXT,
  file_count INTEGER DEFAULT 0,
  turnstile_state TEXT,
  error_code TEXT,
  route_path TEXT,
  ip_hash TEXT,
  user_agent_hash TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_preview_funnel_events_created ON preview_funnel_events(created_at);
CREATE INDEX IF NOT EXISTS idx_preview_funnel_events_type_created ON preview_funnel_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_preview_funnel_events_session_created ON preview_funnel_events(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_preview_funnel_events_job_created ON preview_funnel_events(job_id, created_at);
CREATE INDEX IF NOT EXISTS idx_preview_funnel_events_expires ON preview_funnel_events(expires_at);
