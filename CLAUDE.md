# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

TickrTime is an earnings tracking dashboard built with Next.js 15 and deployed on Cloudflare. It tracks 8,288 US stocks (NASDAQ + NYSE) using the Finnhub API.

**Architecture**: Split frontend + API Worker pattern
- **Frontend**: Next.js on Cloudflare Pages
- **API**: Cloudflare Worker with Hono (`packages/api/`)
- **Database**: Cloudflare D1 (SQLite-compatible)

## Commands

```bash
pnpm dev                     # Run frontend + API together
pnpm dev:frontend            # Next.js on :3000
pnpm dev:api                 # Worker API on :8787

pnpm test:all                # Run all tests (frontend + API)
pnpm test                    # Frontend tests only (Jest)
pnpm test:api                # API tests only (Vitest)
pnpm lint                    # ESLint check
pnpm type-check              # TypeScript check
```

## Key Locations

- `packages/api/src/routes/` - API route handlers
- `packages/api/src/lib/db/` - D1 database operations
- `lib/api-client.ts` - Frontend API client
- `hooks/` - React hooks (use-watchlist, use-alerts)
- `components/earnings-dashboard.tsx` - Main dashboard

## Testing

**93 tests total** - Jest (frontend) + Vitest (API)

| Location | Coverage |
|----------|----------|
| `packages/api/src/__tests__/unit/` | EPS parsing, dates, sector mapping |
| `packages/api/src/__tests__/integration/` | Earnings processing, alert scheduling |
| `packages/api/src/__tests__/cron/` | Ticker sync |
| `hooks/__tests__/`, `components/__tests__/` | React hooks, components |

**Key utilities** (extracted for testability):
- `packages/api/src/lib/earnings-utils.ts` - EPS parsing, surprise calculation
- `packages/api/src/lib/date-utils.ts` - Date helpers, symbol normalization

**CI**: GitHub Actions runs tests on push/PR to main (`.github/workflows/test.yml`)

## Critical Rules

- **Always run tests**: `pnpm test:all` after changes
- **Type safety**: Never use `any`
- **Git workflow**: Never work on main
- **localStorage keys**: `tickrtime-auth-token`, `tickrtime-preferences`

## Environment Variables

```bash
# .env.local (Frontend)
NEXT_PUBLIC_API_URL=http://localhost:8787
```

See `packages/api/CLAUDE.md` for API-specific configuration.

## Utility Scripts

```bash
pnpm sync:tickers                       # Sync ticker data from production
cd packages/api && pnpm dlx tsx scripts/send-test-emails.ts  # Test alert emails
```

## Known Issues

- **Timezone**: Server uses UTC, client uses local timezone for display
- **CORS**: Ensure Worker runs on :8787 and NEXT_PUBLIC_API_URL is set
