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
npm run dev                  # Run frontend + API together
npm run dev:frontend         # Next.js on :3000
npm run dev:api              # Worker API on :8787

npm test                     # Run all tests
npm run lint                 # ESLint check
npm run type-check           # TypeScript check
```

## Key Locations

- `packages/api/src/routes/` - API route handlers
- `packages/api/src/lib/db/` - D1 database operations
- `lib/api-client.ts` - Frontend API client
- `hooks/` - React hooks (use-watchlist, use-alerts)
- `components/earnings-dashboard.tsx` - Main dashboard

## Critical Rules

- **Always run tests**: `npm test` after changes
- **Type safety**: Never use `any`
- **Git workflow**: Use feature branches, never commit to main
- **localStorage keys**: `tickrtime-auth-token`, `tickrtime-preferences`

## Environment Variables

```bash
# .env.local (Frontend)
NEXT_PUBLIC_API_URL=http://localhost:8787
```

See `packages/api/CLAUDE.md` for API-specific configuration.

## Utility Scripts

```bash
npm run sync:tickers                    # Sync ticker data from production
cd packages/api && npx tsx scripts/send-test-emails.ts  # Test alert emails
```

## Known Issues

- **Timezone**: Server uses UTC, client uses local timezone for display
- **CORS**: Ensure Worker runs on :8787 and NEXT_PUBLIC_API_URL is set
