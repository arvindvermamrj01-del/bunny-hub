-- BunnyHub production security database: Cloudflare D1 binding VH_SECURITY_DB.
-- IPs are captured only by Pages Functions from CF-Connecting-IP, never from browser payloads.
-- The security activity API is the only app read path and requires profiles.role = 'admin'.
-- Keep raw IP and user-agent for up to 90 days; never store passwords, OTPs, or auth tokens.

CREATE TABLE IF NOT EXISTS vh_security_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  user_id TEXT,
  account_email TEXT,
  user_role TEXT,
  ip_address TEXT NOT NULL,
  user_agent TEXT NOT NULL DEFAULT '',
  page_path TEXT NOT NULL DEFAULT '',
  session_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS vh_security_events_created_idx
  ON vh_security_events(created_at DESC);

CREATE INDEX IF NOT EXISTS vh_security_events_ip_type_idx
  ON vh_security_events(ip_address,event_type,created_at DESC);

CREATE INDEX IF NOT EXISTS vh_security_events_user_idx
  ON vh_security_events(user_id,created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS vh_security_guest_session_idx
  ON vh_security_events(session_id)
  WHERE event_type='guest_visit' AND session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS vh_admin_login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id TEXT NOT NULL UNIQUE,
  ip_address TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','failed','success','denied')),
  started_at INTEGER NOT NULL DEFAULT (unixepoch()),
  finished_at INTEGER,
  user_id TEXT,
  account_email TEXT,
  user_role TEXT
);

CREATE INDEX IF NOT EXISTS vh_admin_login_attempts_ip_status_idx
  ON vh_admin_login_attempts(ip_address,status,started_at DESC);
