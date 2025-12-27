-- Migration: 002_tickers_table.sql
-- Purpose: Add tickers table for all US stock symbols with industry classification
--          and earnings_history table for cached historical earnings data

-- Ticker metadata table
-- Stores all NASDAQ and NYSE symbols with optional industry enrichment
CREATE TABLE IF NOT EXISTS tickers (
  symbol TEXT PRIMARY KEY,
  description TEXT,
  exchange TEXT NOT NULL,           -- 'NASDAQ' or 'NYSE'
  industry TEXT,                    -- Finnhub industry (nullable until enriched via profile2)
  sector TEXT,                      -- Mapped broader sector for filtering
  is_active INTEGER DEFAULT 1,      -- 0 = delisted, 1 = active
  profile_fetched_at TEXT,          -- ISO timestamp of when profile2 was last fetched
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_tickers_industry ON tickers(industry);
CREATE INDEX IF NOT EXISTS idx_tickers_sector ON tickers(sector);
CREATE INDEX IF NOT EXISTS idx_tickers_active ON tickers(is_active);
CREATE INDEX IF NOT EXISTS idx_tickers_exchange ON tickers(exchange);

-- Historical earnings table (immutable once populated)
-- Caches past earnings results to avoid repeated Finnhub API calls
CREATE TABLE IF NOT EXISTS earnings_history (
  id TEXT PRIMARY KEY,              -- Format: symbol_YYYYQN (e.g., AAPL_2024Q3)
  symbol TEXT NOT NULL,
  period TEXT NOT NULL,             -- End date of fiscal period (e.g., "2024-09-30")
  quarter INTEGER NOT NULL,         -- 1-4
  year INTEGER NOT NULL,
  actual REAL,                      -- Actual EPS reported
  estimate REAL,                    -- Consensus EPS estimate
  surprise REAL,                    -- Actual - Estimate
  surprise_percent REAL,            -- Percentage beat/miss
  revenue_actual REAL,              -- Actual revenue (if available)
  revenue_estimate REAL,            -- Revenue estimate (if available)
  reported_at TEXT,                 -- When earnings were reported
  created_at TEXT NOT NULL,
  FOREIGN KEY (symbol) REFERENCES tickers(symbol) ON DELETE CASCADE
);

-- Indexes for historical earnings queries
CREATE INDEX IF NOT EXISTS idx_earnings_symbol ON earnings_history(symbol);
CREATE INDEX IF NOT EXISTS idx_earnings_date ON earnings_history(year, quarter);
CREATE UNIQUE INDEX IF NOT EXISTS idx_earnings_unique ON earnings_history(symbol, year, quarter);
