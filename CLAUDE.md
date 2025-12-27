# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TickrTime is an earnings tracking dashboard for technology stocks built with Next.js 15 and deployed on Cloudflare. It tracks 2,246+ tech companies using the Finnhub API.

**Architecture**: Split frontend + API Worker pattern
- **Frontend**: Next.js app on `localhost:3000`
- **API**: Cloudflare Worker with Hono framework on `localhost:8787`
- **Database**: Cloudflare D1 (SQLite-compatible)
- **Shared Types**: `@tickrtime/shared` package

## Commands

```bash
# Development (runs both frontend + API together)
npm run dev

# Run separately
npm run dev:frontend          # Next.js on :3000
npm run dev:api              # Worker API on :8787

# Quality
npm run lint && npm run type-check

# Testing
npm test                      # Run all tests
npm test -- --watch          # Watch mode
npm test -- path/to/file     # Single file

# Database migrations
cd packages/api
npm run migrate:local        # Local D1
npm run migrate:production   # Production D1

# Deploy API Worker
cd packages/api
npm run deploy:production
```

## Architecture

### Data Flow
```
Frontend (Next.js) → lib/api-client.ts → Worker API (Hono) → D1 Database
                                                           → Finnhub API
```

### Key Locations
- `packages/api/src/routes/` - API route handlers (auth, alerts, earnings, watchlist)
- `packages/api/src/lib/db/` - D1 database operations
- `lib/api-client.ts` - Frontend API client (all API calls go through here)
- `hooks/` - React hooks (use-watchlist, use-alerts, use-table-sort)
- `components/earnings-dashboard.tsx` - Main dashboard orchestrator
- `data/tech_tickers.json` - Tech company database (2,246+ companies)

### API Endpoints (on :8787)
- Auth: `/api/auth/signup`, `/api/auth/login`, `/api/auth/me`, `/api/auth/verify-email`
- Alerts: `/api/alerts`, `/api/alerts/:id`, `/api/alerts/preferences`
- Earnings: `/api/earnings-today`, `/api/earnings-tomorrow`, `/api/earnings-next-30-days`
- Watchlist: `/api/watchlist`

## Critical Rules

- **Type safety mandatory**: Never use `any`. Request approval if you believe it's necessary
- **Edge Runtime**: All Next.js API routes must use `export const runtime = "edge"`
- **Git workflow**: Never work directly on main; use feature branches
- **localStorage keys**: `tickrtime-auth-token`, `tickrtime-preferences`, `tickrtime-watchlist`
- **Tech ticker filtering**: Always filter API results using `techTickers.map(t => t.symbol)` Set
- **Responsive design**: Mobile-first with card layout, desktop with table layout

## Patterns

### API Client Usage (Frontend)
```typescript
import { apiClient } from "@/lib/api-client";

// All API calls go through the client
const earnings = await apiClient.getEarningsToday();
const user = await apiClient.getCurrentUser();
```

### Hook Return Types
```typescript
// Always define clear return interfaces for hooks
export interface UseWatchlistReturn {
  watchlist: WatchlistState;
  addToWatchlist: (symbol: string) => Promise<boolean>;
  isInWatchlist: (symbol: string) => boolean;
  loading: boolean;
  error: string | null;
}
```

### Worker Route Pattern
```typescript
// packages/api/src/routes/*.ts
import { Hono } from "hono";
const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const db = c.env.DB;  // D1 database binding
  // ... handler logic
});
```

## Environment Variables

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:8787   # Worker API URL
FINNHUB_API_KEY=your_key                     # Required for earnings data
RESEND_API_KEY=your_key                      # Required for email verification
```

## Known Issues

- **Timezone inconsistency**: Server uses UTC for "today", client uses local timezone for display
- **CORS errors**: Ensure Worker is running on :8787 and NEXT_PUBLIC_API_URL is set correctly
