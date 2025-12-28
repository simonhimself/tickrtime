# Plan: Bulk Enrichment for Production Launch

## Goal
Enrich all 8,200+ tickers with industry/sector data before app launch.

---

## Approach: Batch Update API + Local Enrichment Script

### Why This Approach
- Running `wrangler d1 execute` 8,200 times is too slow (each spawns a process)
- The cron endpoint only does 50/run, would need 164 manual calls
- **Solution:** Add a batch API endpoint, run enrichment locally, send batches to production

### Implementation Steps

#### Step 1: Add Batch Profile Update Endpoint
Create `POST /api/tickers/batch-update-profiles` that accepts an array of profile updates.

**File:** `packages/api/src/routes/tickers.ts`

```typescript
// POST /api/tickers/batch-update-profiles - Batch update ticker profiles (for enrichment)
app.post('/batch-update-profiles', async (c) => {
  // Authenticate with cron secret
  const cronSecret = c.req.header('x-cron-secret');
  if (cronSecret !== c.env.CRON_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { updates } = await c.req.json<{
    updates: Array<{ symbol: string; industry: string | null; sector: string | null }>
  }>();

  const db = createDB(c.env);
  let updated = 0;

  for (const update of updates) {
    const success = await updateTickerProfile(db, update.symbol, {
      industry: update.industry,
      sector: update.sector,
    });
    if (success) updated++;
  }

  return c.json({ success: true, updated, total: updates.length });
});
```

#### Step 2: Fix ES Module Issues in Script
Replace `require('fs')` with ES module imports in `populate_ticker_universe.ts`.

#### Step 3: Add Enrichment-Only Mode for Production
Modify script to support `--enrich-remote` flag that:
1. Fetches profiles from Finnhub (rate-limited, ~3 hours)
2. Batches updates (50 per batch)
3. Sends to production via the new batch API endpoint

### Execution Flow

```
Local Script                    Production API
     |                               |
     |--[Finnhub /stock/profile2]--> |
     |   (55/min, ~8200 calls)       |
     |                               |
     |--[POST /batch-update-profiles]-->
     |   (50 updates per call)       |
     |   (~164 API calls total)      |
     |                               |
     ✓ Done in ~3 hours              ✓ All tickers enriched
```

### Files to Modify
1. `packages/api/src/routes/tickers.ts` - Add batch update endpoint
2. `scripts/populate_ticker_universe.ts` - Fix ES modules, add `--enrich-remote`

### Verified API Limits

**Finnhub** ([docs](https://finnhub.io/docs/api/rate-limit)):
- Free tier: 60 calls/minute
- Endpoint: `/stock/profile2?symbol=XXX`
- Returns: `finnhubIndustry` field

**Cloudflare D1** ([limits](https://developers.cloudflare.com/d1/platform/limits/)):
- No explicit batch size limit
- 30-second timeout per batch
- Recommended: ~1,000 rows per batch

### Time Estimate
- Implementation: ~1 hour
- Script runtime: ~2.5 hours (8,200 calls ÷ 60/min = 137 min)

---

## Previous Plan (Completed)

---

## Problem

The `/api/cron/sync-tickers` endpoint exists and is ready, but:
1. Cloudflare cron triggers fire a `scheduled` event, not HTTP requests
2. The Worker only exports Hono's HTTP handler (no `scheduled` handler)
3. Result: The cron fires daily at 9 AM UTC but nothing happens

---

## Fix Required

Add a `scheduled` event handler to `packages/api/src/index.ts` that calls both cron endpoints.

### Implementation

```typescript
// Add to packages/api/src/index.ts

export default {
  fetch: app.fetch,

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Call both cron endpoints
    const baseUrl = 'https://tickrtime-api.simons.workers.dev';
    const headers = { 'x-cron-secret': env.CRON_SECRET || '' };

    // Run alert check and ticker sync
    await Promise.all([
      fetch(`${baseUrl}/api/cron/check-alerts`, { method: 'POST', headers }),
      fetch(`${baseUrl}/api/cron/sync-tickers`, { method: 'POST', headers }),
    ]);
  },
};
```

### Files to Modify
- `packages/api/src/index.ts` - Add scheduled event handler

---

## Completed Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Database Schema (`tickers` table) | ✅ |
| 2 | Population Script (8,288 tickers) | ✅ |
| 3 | Daily Cron Endpoint (`/sync-tickers`) | ✅ (endpoint ready) |
| 4 | Earnings Routes (D1 backed) | ✅ |
| 5 | Ticker API Endpoints | ✅ |
| 6 | Frontend Sector Filtering | ✅ |
| 7 | Production Deployment | ✅ |
| 8 | Historical Earnings | ⏳ Future (paid plan) |

---

## What the Daily Cron Does (once wired)

**`/api/cron/sync-tickers`** runs daily to:
1. Fetch current NASDAQ + NYSE symbols (detects new IPOs)
2. Mark delisted symbols as `is_active = 0`
3. Enrich 50 unenriched tickers with industry/sector data

This keeps the ticker universe current without manual intervention.

---

## Migration Steps Status

| Step | Description | Status |
|------|-------------|--------|
| 1 | Run D1 Migration | ✅ Done |
| 2 | Populate Ticker Universe | ✅ Done (8,288 tickers) |
| 3 | Enable Feature Flag (`USE_DB_TICKERS=true`) | ✅ Done |
| 4 | Set Up Daily Sync Cron | ⚠️ **Needs wiring** |
| 5 | Cleanup (remove old JSON) | ⏳ Optional |

---

## Remaining Work

### 1. Wire the Scheduled Handler (required)
Add to `packages/api/src/index.ts` to make the cron trigger actually work.

### 2. Cleanup Old Files (optional)
Once confirmed stable, can remove:
- `data/tech_tickers.json` (50KB, no longer used)
- `scripts/build_tech_universe.ts` (legacy build script)

---

## IPO Detection Analysis

### Current Approach: Exchange Symbol Comparison ✅

```
Our DB ←→ Compare ←→ Finnhub /stock/symbol (NASDAQ + NYSE)
                       ↓
          New in exchange = Insert (IPO/new listing)
          Missing from exchange = Mark inactive (delisted)
```

**Why this is correct:**
- Catches ALL new listings (IPOs, direct listings, SPACs, spin-offs)
- Uses exchange list as ground truth for what's tradeable
- Automatically detects delistings
- 2 API calls per day (well within rate limits)

### Alternative: IPO Calendar API

Finnhub's `/calendar/ipo` provides upcoming IPO events with:
- `status`: "expected", "filed", "priced", "withdrawn"
- IPO metadata: offering price, shares, date

**Limitation:** Only covers traditional IPOs, misses direct listings/SPACs/spin-offs.

### Recommendation

| Use Case | Best API |
|----------|----------|
| Sync ticker universe | Exchange symbols (current ✅) |
| "Upcoming IPOs" feature | IPO Calendar (future addition) |

**Current design is correct** - just needs the scheduled handler wired up.
