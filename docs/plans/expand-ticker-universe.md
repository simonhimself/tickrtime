# Plan: Expand Ticker Universe to All US Stocks

## Implementation Status

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | ✅ Complete | Database schema created |
| Phase 2 | ✅ Complete | Population script ready |
| Phase 3 | ✅ Complete | Daily sync cron added |
| Phase 4 | ✅ Complete | Earnings routes updated |
| Phase 5 | ✅ Complete | Ticker API endpoints created |
| Phase 6 | ✅ Complete | Frontend sector filtering added |
| Phase 7 | ✅ Complete | Migration docs ready |
| Phase 8 | ⏳ Future | Historical earnings (requires paid plan) |

---

## Goal
Replace the static tech-only `tech_tickers.json` (2,245 stocks) with a D1-backed system supporting all ~10,000 NASDAQ/NYSE stocks with industry classification, daily automated refresh, sector filtering, **and cached historical earnings data**.

---

## Current State
- **Static file**: `data/tech_tickers.json` with only "Technology" industry stocks
- **Build process**: `scripts/build_tech_universe.ts` takes 3+ hours (1 API call per symbol for profile)
- **Limitation**: `/stock/symbol` returns basic info but NOT industry; `/stock/profile2` required per symbol

---

## Implementation Phases

### Phase 1: Database Schema
Create `tickers` table in D1 to store all stock metadata.

**Files to create/modify:**
- `packages/api/migrations/002_tickers_table.sql` (new)
- `packages/api/src/lib/db/tickers.ts` (new - follow `alerts.ts` pattern)

**Schema:**
```sql
-- Ticker metadata table
CREATE TABLE tickers (
  symbol TEXT PRIMARY KEY,
  description TEXT,
  exchange TEXT NOT NULL,
  industry TEXT,                    -- Finnhub industry (nullable until enriched)
  sector TEXT,                      -- Mapped broader sector
  is_active INTEGER DEFAULT 1,
  profile_fetched_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_tickers_industry ON tickers(industry);
CREATE INDEX idx_tickers_sector ON tickers(sector);
CREATE INDEX idx_tickers_active ON tickers(is_active);

-- Historical earnings table (immutable once populated)
CREATE TABLE earnings_history (
  id TEXT PRIMARY KEY,              -- symbol_YYYYQN format (e.g., AAPL_2024Q3)
  symbol TEXT NOT NULL,
  period TEXT NOT NULL,             -- e.g., "2024-09-30"
  quarter INTEGER NOT NULL,         -- 1-4
  year INTEGER NOT NULL,
  actual REAL,                      -- Actual EPS
  estimate REAL,                    -- Estimated EPS
  surprise REAL,                    -- Actual - Estimate
  surprise_percent REAL,            -- Percentage beat/miss
  revenue_actual REAL,              -- If available from paid plan
  revenue_estimate REAL,
  reported_at TEXT,                 -- When earnings were reported
  created_at TEXT NOT NULL,
  FOREIGN KEY (symbol) REFERENCES tickers(symbol)
);

CREATE INDEX idx_earnings_symbol ON earnings_history(symbol);
CREATE INDEX idx_earnings_date ON earnings_history(year, quarter);
CREATE UNIQUE INDEX idx_earnings_unique ON earnings_history(symbol, year, quarter);
```

---

### Phase 2: Initial Population Script
Local script to populate all symbols, then progressively enrich with industry data.

**Files to create:**
- `scripts/populate_ticker_universe.ts` (new)

**Process:**
1. Fetch all symbols from NASDAQ + NYSE (2 API calls, instant)
2. Bulk insert all ~10,000 symbols into D1 via HTTP API
3. Progressively call `/stock/profile2` for each symbol (55/min to stay under limit)
4. Save progress to resume if interrupted
5. Map `finnhubIndustry` to broader `sector` categories

**Sector mapping** (store both for flexibility):
- Technology, Software, Hardware, Semiconductors → "Technology"
- Healthcare, Pharmaceuticals, Biotechnology → "Healthcare"
- Financial Services, Banks, Insurance → "Financials"
- Consumer Cyclical, Consumer Defensive, Retail → "Consumer"
- etc.

---

### Phase 3: Daily Sync Cron Job
Extend existing cron to detect new IPOs/delistings and enrich new symbols.

**Files to modify:**
- `packages/api/src/routes/cron.ts` - add `/sync-tickers` endpoint
- `packages/api/wrangler.toml` - add cron trigger (5 AM daily)

**Process:**
1. Fetch current exchange symbols (2 API calls)
2. Compare with stored symbols → identify new and delisted
3. Insert new symbols (without profile)
4. Mark delisted as `is_active = 0`
5. Enrich up to 50 unenriched symbols per run (within rate limits)

---

### Phase 4: Update Earnings Routes
Replace static JSON import with D1 database queries.

**Files to modify:**
- `packages/api/src/routes/earnings-today.ts`
- `packages/api/src/routes/earnings-tomorrow.ts`
- `packages/api/src/routes/earnings-next-30-days.ts`
- `packages/api/src/routes/earnings-previous-30-days.ts`
- `packages/api/src/routes/earnings-watchlist.ts`
- `packages/api/src/routes/earnings.ts`

**Changes:**
```typescript
// Before
import techTickers from '../../data/tech_tickers.json';
const techSymbols = new Set(techTickers.map(t => t.symbol));

// After
const activeSymbols = await getActiveSymbols(c.env.DB);
const tickerMetadata = await getTickerMetadataMap(c.env.DB);
```

**Add to response:**
- `industry` field
- `sector` field

---

### Phase 5: New Ticker API Endpoints
Expose ticker data for frontend filtering.

**Files to create:**
- `packages/api/src/routes/tickers.ts` (new)

**Endpoints:**
- `GET /api/tickers` - list tickers with optional filters (`?sector=Technology`)
- `GET /api/tickers/sectors` - list distinct sectors for dropdown
- `GET /api/tickers/:symbol` - get single ticker metadata

---

### Phase 6: Frontend Sector Filtering
Add sector filter to earnings dashboard.

**Files to modify:**
- `lib/api-client.ts` - add sector param to earnings endpoints
- `components/earnings-dashboard.tsx` - add sector filter dropdown
- `types/index.ts` - update `ProcessedEarning` type with industry/sector

---

### Phase 7: Migration & Cleanup
Feature flag for safe rollout, then remove old JSON file.

**Migration Steps:**

#### Step 1: Run D1 Migration (if not already done)
```bash
cd packages/api
npm run migrate:local        # For local development
npm run migrate:production   # For production D1
```

#### Step 2: Populate Ticker Universe
Before enabling the feature flag, populate the D1 database:

```bash
# Set your Finnhub API key
export FINNHUB_API_KEY=your_api_key

# Set your Cloudflare credentials
export CLOUDFLARE_ACCOUNT_ID=your_account_id
export CLOUDFLARE_API_TOKEN=your_api_token
export CLOUDFLARE_DATABASE_ID=your_d1_database_id

# Run the population script
npm run populate:tickers
```

This will:
- Fetch all NASDAQ and NYSE symbols (~10,000 stocks)
- Insert them into the D1 `tickers` table
- Progressively enrich with industry/sector data (55/min due to rate limits)
- Save progress to resume if interrupted (~3 hours total)

#### Step 3: Enable Feature Flag
Add to your wrangler.toml or environment variables:
```toml
[vars]
USE_DB_TICKERS = "true"
```

Or in Cloudflare dashboard: Settings → Variables → Add `USE_DB_TICKERS = true`

#### Step 4: Set Up Daily Sync Cron
Add to wrangler.toml:
```toml
[triggers]
crons = ["0 5 * * *"]  # Run at 5 AM UTC daily
```

The cron job will:
- Detect new IPOs and delistings
- Enrich up to 50 unenriched symbols per run
- Keep the ticker universe current

#### Step 5: Verify and Cleanup (After Successful Migration)
Once confirmed working in production:
1. Remove `data/tech_tickers.json`
2. Remove `scripts/build_tech_universe.ts`
3. Remove feature flag code (optional, can keep for rollback)

**Current Files Created/Modified:**
- `packages/api/migrations/002_tickers_table.sql` - D1 schema
- `packages/api/src/lib/db/tickers.ts` - DB operations
- `packages/api/src/lib/ticker-data.ts` - Feature flag helper
- `packages/api/src/routes/tickers.ts` - New API endpoints
- `packages/api/src/routes/cron.ts` - Daily sync endpoint
- `scripts/populate_ticker_universe.ts` - Population script
- `lib/api-client.ts` - Added tickers API functions
- `types/index.ts` - Added industry/sector to EarningsData
- `components/earnings-dashboard.tsx` - Added sector filter UI

---

### Phase 8: Historical Earnings Enrichment (Future - Paid Plan)
Cache 2 years of historical earnings data in D1 for instant lookups.

**Files to create:**
- `scripts/populate_historical_earnings.ts` (new)
- `packages/api/src/lib/db/earnings-history.ts` (new)

**Strategy - One-Time Paid Finnhub Subscription:**
1. Temporarily upgrade to paid Finnhub plan (higher rate limits)
2. For each of ~10,000 active symbols, call `/stock/earnings?symbol=XXX`
3. Store all historical quarters (8 quarters = 2 years) in `earnings_history` table
4. Downgrade back to free plan after bulk fetch

**API Considerations:**
- Free plan: 60 calls/min → 10,000 symbols = ~167 minutes (~3 hours)
- Paid plan (e.g., $49/mo): 300 calls/min → 10,000 symbols = ~33 minutes
- Each `/stock/earnings` call returns ALL historical quarters for that symbol

**Data Usage After Enrichment:**
- `/api/earnings?symbol=AAPL&year=2024` → Query D1 first, fall back to Finnhub
- Show historical EPS trends on stock detail pages
- Enable "earnings history" view for watchlisted stocks

**Ongoing Maintenance:**
- Daily cron: After each earnings report, fetch and cache the new quarter
- Only ~50-100 companies report per day, well within free tier limits

**Files to modify:**
- `packages/api/src/routes/earnings.ts` - check D1 cache before Finnhub call
- `components/stock-detail.tsx` - display historical earnings chart (new)

---

## Critical Files Reference

| Purpose | File Path |
|---------|-----------|
| Current ticker data | `data/tech_tickers.json` |
| Current build script | `scripts/build_tech_universe.ts` |
| DB pattern to follow | `packages/api/src/lib/db/alerts.ts` |
| Migration template | `packages/api/migrations/001_initial_schema.sql` |
| Cron routes | `packages/api/src/routes/cron.ts` |
| Main earnings route | `packages/api/src/routes/earnings.ts` |
| API client | `lib/api-client.ts` |
| Historical earnings (Phase 8) | `packages/api/src/routes/earnings.ts` (modify to check D1 cache) |

---

## Rate Limit Strategy

| Scenario | Approach |
|----------|----------|
| Initial ticker population | 55 calls/min × 182 min = ~3 hours (one-time local run) |
| Daily ticker sync | 2 calls for symbols + 50 enrichments = 52 calls max |
| Normal operations | Cached symbols from D1, no Finnhub calls for filtering |
| Historical earnings (paid) | 300 calls/min × 33 min = ~33 minutes (one-time) |
| Daily earnings cache | ~50-100 calls for newly reported earnings (within free tier) |

---

## Performance Optimization

- Cache active symbols in KV with 1-hour TTL for hot path
- D1 queries are fast (~5ms) but add caching for frequent lookups
- Bundle size reduced by removing 50KB JSON file

---

## Estimated Timeline

| Phase | Effort |
|-------|--------|
| Phase 1: Database Schema | 1 hour |
| Phase 2: Population Script | 2-3 hours (+ 3 hours runtime) |
| Phase 3: Daily Cron | 1-2 hours |
| Phase 4: Update Earnings Routes | 2-3 hours |
| Phase 5: Ticker API | 1 hour |
| Phase 6: Frontend Filtering | 2-3 hours |
| Phase 7: Migration | 1 hour |
| Phase 8: Historical Earnings | 3-4 hours (+ paid plan runtime) |
| **Total** | **~15-19 hours dev time** |

**Note:** Phase 8 is designed to be done later when you're ready for a one-time paid Finnhub subscription. The schema is included now so it's ready when needed.
