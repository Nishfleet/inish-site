CREATE TABLE IF NOT EXISTS support_requests (
  id TEXT PRIMARY KEY,
  job_id TEXT,
  email TEXT,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  ip_hash TEXT,
  user_agent_hash TEXT,
  status TEXT DEFAULT 'open',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_support_requests_status ON support_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_support_requests_email ON support_requests(email, created_at);
CREATE INDEX IF NOT EXISTS idx_support_requests_job ON support_requests(job_id);
CREATE INDEX IF NOT EXISTS idx_support_requests_ip ON support_requests(ip_hash, created_at);
