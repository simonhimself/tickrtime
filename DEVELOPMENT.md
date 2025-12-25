# Development Guide

## Architecture Overview

TickrTime now uses a separated frontend + API Worker architecture:

- **Frontend**: Next.js app (runs on `localhost:3000`)
- **API**: Cloudflare Worker (runs on `localhost:8787`)
- **Database**: Cloudflare D1 (accessible via Worker)

## Running the Development Servers

### Option 1: Run Both Together (Recommended)

To run both frontend and API together using Turbo:

```bash
npm run dev
```

This will start:
- Frontend on `http://localhost:3000`
- API Worker on `http://localhost:8787`

### Option 2: Run Separately

**Terminal 1 - Frontend:**
```bash
npm run dev:frontend
```
Runs Next.js frontend on `http://localhost:3000`

**Terminal 2 - API:**
```bash
npm run dev:api
```
Runs Cloudflare Worker API on `http://localhost:8787` with full D1 support

### Option 3: API Only (for testing)

```bash
cd packages/api
npm run dev
```

## Environment Variables

Create a `.env.local` file in the root directory:

```bash
# API Configuration
# In development, the API Worker runs on localhost:8787
NEXT_PUBLIC_API_URL=http://localhost:8787
```

For production, set `NEXT_PUBLIC_API_URL` to your deployed Worker URL.

## Database Setup

### Initial Setup

The D1 database is configured in `packages/api/wrangler.toml`. To set up:

1. **Create D1 database** (if not already created):
   ```bash
   cd packages/api
   npx wrangler d1 create tickrtime-db
   ```

2. **Apply migrations**:
   ```bash
   cd packages/api
   npm run migrate:local  # For local development
   npm run migrate:staging  # For staging
   npm run migrate:production  # For production
   ```

### Viewing Database

```bash
cd packages/api

# View local database
npx wrangler d1 execute tickrtime-db --command="SELECT * FROM users LIMIT 10;" --local

# View remote database
npx wrangler d1 execute tickrtime-db --command="SELECT * FROM users LIMIT 10;" --remote
```

## Project Structure

```
claude-tickrtime/
├── packages/
│   ├── api/              # Cloudflare Worker API
│   │   ├── src/
│   │   │   ├── routes/   # API route handlers
│   │   │   └── lib/      # Business logic
│   │   └── wrangler.toml # Worker configuration
│   └── shared/           # Shared types and utilities
├── app/                  # Next.js frontend pages
├── components/           # React components
├── lib/
│   └── api-client.ts     # API client for frontend
└── package.json          # Root workspace config
```

## API Endpoints

All API endpoints are available at `http://localhost:8787/api/*`:

- **Auth**: `/api/auth/signup`, `/api/auth/login`, `/api/auth/me`, `/api/auth/verify-email`
- **Alerts**: `/api/alerts`, `/api/alerts/:id`, `/api/alerts/preferences`
- **Earnings**: `/api/earnings`, `/api/earnings-today`, `/api/earnings-tomorrow`, etc.
- **Watchlist**: `/api/watchlist`
- **Cron**: `/api/cron/check-alerts`

## Troubleshooting

### "Failed to fetch" or CORS Errors

- Make sure the API Worker is running on `localhost:8787`
- Check that `NEXT_PUBLIC_API_URL` is set correctly in `.env.local`
- Verify CORS is configured in `packages/api/src/index.ts`

### "User not found" Error

1. Make sure you're using the API Worker (not old Next.js API routes)
2. Sign up again if your account was created before the migration
3. Check the database: `npx wrangler d1 execute tickrtime-db --command="SELECT * FROM users;" --local`

### Database Not Found

1. Check `packages/api/wrangler.toml` has the correct `database_id`
2. Run: `cd packages/api && npx wrangler d1 list` to see available databases
3. Make sure you're running `npm run dev:api` (not `npm run dev:frontend`)

### Port Already in Use

If port 8787 is already in use:
- Change the port in `packages/api/wrangler.toml` or use `--port` flag
- Update `NEXT_PUBLIC_API_URL` in `.env.local` to match

## Testing

### API Integration Tests

```bash
# Start API Worker in one terminal
npm run dev:api

# In another terminal, run tests
cd packages/api
npm test
```

### Frontend Tests

```bash
npm test
```

## Deployment

### Deploy API Worker

```bash
cd packages/api
npm run deploy:staging    # Deploy to staging
npm run deploy:production # Deploy to production
```

### Deploy Frontend

The frontend is deployed as a Cloudflare Pages application. Set `NEXT_PUBLIC_API_URL` to your production Worker URL in the Pages environment variables.

## Development Tips

1. **Use separate terminals**: Run frontend and API in separate terminals for better logs
2. **Check API logs**: The Worker logs will show in the terminal running `npm run dev:api`
3. **Database persistence**: Local D1 data is stored in `packages/api/.wrangler/state/`
4. **Hot reload**: Both frontend and API support hot reload during development
