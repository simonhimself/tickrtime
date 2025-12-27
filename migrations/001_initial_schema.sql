-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  email_normalized TEXT UNIQUE NOT NULL, -- lowercase for lookups
  password_hash TEXT NOT NULL,
  email_verified INTEGER DEFAULT 0, -- SQLite uses INTEGER for booleans (0/1)
  notification_preferences TEXT, -- JSON: {emailEnabled, defaultDaysBefore, defaultDaysAfter}
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_users_email_normalized ON users(email_normalized);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  alert_type TEXT NOT NULL CHECK(alert_type IN ('before', 'after')),
  days_before INTEGER,
  days_after INTEGER,
  recurring INTEGER DEFAULT 0, -- SQLite uses INTEGER for booleans (0/1)
  earnings_date TEXT NOT NULL, -- ISO date
  scheduled_email_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'sent', 'cancelled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_symbol ON alerts(symbol);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_earnings_date ON alerts(earnings_date);
CREATE INDEX IF NOT EXISTS idx_alerts_user_status ON alerts(user_id, status);

-- Watchlists table (optional - can keep in KV, but including for consistency)
CREATE TABLE IF NOT EXISTS watchlists (
  user_id TEXT PRIMARY KEY,
  tickers TEXT NOT NULL, -- JSON array
  last_updated TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);





