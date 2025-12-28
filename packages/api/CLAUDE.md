# API Worker - CLAUDE.md

This file provides API-specific guidance. Auto-loaded when working in `packages/api/`.

## Commands

```bash
# Deployment
npm run deploy:staging        # Deploy to staging
npm run deploy:production     # Deploy to production

# Database migrations
npm run migrate:local         # Local D1
npm run migrate:staging       # Staging D1
npm run migrate:production    # Production D1
```

## API Endpoints

**Auth:** `/api/auth/signup`, `/api/auth/login`, `/api/auth/me`, `/api/auth/verify-email`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/change-password`, `/api/auth/account` (DELETE)

**Alerts:** `/api/alerts`, `/api/alerts/:id`, `/api/alerts/symbol/:symbol` (DELETE - cascade), `/api/alerts/preferences`, `/api/alerts/unsubscribe`

**Earnings:** `/api/earnings`, `/api/earnings-today`, `/api/earnings-tomorrow`, `/api/earnings-next-30-days`, `/api/earnings-previous-30-days`, `/api/earnings-watchlist`

**Tickers:** `/api/tickers`, `/api/tickers/sectors`, `/api/tickers/:symbol`

**Watchlist:** `/api/watchlist` (GET, POST, DELETE)

**Cron:** `/api/cron/check-alerts`, `/api/cron/sync-tickers`

## Cloudflare Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| `DB` | D1 Database | Users, alerts, watchlists, tickers |
| `TICKRTIME_KV` | KV Namespace | Verification tokens, password reset |

## Cron Jobs

Runs daily at **9 AM UTC** (`0 9 * * *`):
- `check-alerts` - Process "after" earnings alerts, send emails
- `sync-tickers` - Fetch new symbols from Finnhub, mark delisted inactive

Requires `x-cron-secret` header matching `CRON_SECRET`.

## Secrets Management

**Local dev** - Create `.dev.vars` (not committed):
```
FINNHUB_API_KEY=your_key
RESEND_API_KEY=your_key
JWT_SECRET=your_secret
CRON_SECRET=your_secret
```

**Production** - Set via CLI:
```bash
wrangler secret put FINNHUB_API_KEY --env production
wrangler secret put RESEND_API_KEY --env production
wrangler secret put JWT_SECRET --env production
wrangler secret put CRON_SECRET --env production
```

## Environment Variables

In `wrangler.toml` (non-secret):
```
NODE_ENV=development|staging|production
NEXT_PUBLIC_APP_URL=http://localhost:3000
SEND_VERIFICATION_EMAILS=false  # true in staging/production
USE_DB_TICKERS=true
```

## Key Files

- `src/routes/` - All API route handlers
- `src/lib/db/` - D1 database operations
- `src/lib/email.ts` - Resend email integration
- `src/lib/auth.ts` - JWT authentication
- `wrangler.toml` - Cloudflare Worker config
