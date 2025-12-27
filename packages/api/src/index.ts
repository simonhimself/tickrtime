import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { D1Database, KVNamespace, ScheduledEvent, ExecutionContext } from '@cloudflare/workers-types';
import { createLogger } from './lib/logger';
import authRoutes from './routes/auth';
import alertsRoutes from './routes/alerts';
import earningsRoutes from './routes/earnings';
import earningsTodayRoutes from './routes/earnings-today';
import earningsTomorrowRoutes from './routes/earnings-tomorrow';
import earningsNext30DaysRoutes from './routes/earnings-next-30-days';
import earningsPrevious30DaysRoutes from './routes/earnings-previous-30-days';
import earningsWatchlistRoutes from './routes/earnings-watchlist';
import watchlistRoutes from './routes/watchlist';
import cronRoutes from './routes/cron';
import tickersRoutes from './routes/tickers';

export interface Env {
  DB: D1Database;
  TICKRTIME_KV: KVNamespace;
  RESEND_API_KEY?: string;
  FINNHUB_API_KEY?: string;
  JWT_SECRET: string;
  NEXT_PUBLIC_APP_URL: string;
  NODE_ENV: string;
  CRON_SECRET?: string;
  SEND_VERIFICATION_EMAILS?: string;
  USE_DB_TICKERS?: string; // Feature flag: 'true' to use D1 tickers, 'false' or undefined for legacy JSON
  [key: string]: unknown;
}

const app = new Hono<{ Bindings: Env }>();
const logger = createLogger('api');

// Request logging middleware
app.use('/*', async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  const userAgent = c.req.header('user-agent') || 'unknown';
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
  
  logger.info('Request started', { method, path, userAgent, ip });
  
  await next();
  
  const duration = Date.now() - start;
  const status = c.res.status;
  
  logger.info('Request completed', { method, path, status, duration });
});

// Allowed origins for CORS
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
];

// CORS configuration
app.use('/*', cors({
  origin: (origin: string): string | null => {
    // Allow requests with no origin (like Postman, curl)
    if (!origin) return allowedOrigins[0] ?? null;

    // Check if origin is allowed
    if (allowedOrigins.includes(origin)) {
      return origin;
    }

    // Allow production origins dynamically (will be set via env in actual requests)
    // For now, allow the origin if it matches tickrtime domain pattern
    if (origin.includes('tickrtime')) {
      return origin;
    }

    // Default to first allowed origin
    return allowedOrigins[0] ?? null;
  },
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
}));

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    environment: c.env!.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// API routes
app.route('/api/auth', authRoutes);
app.route('/api/alerts', alertsRoutes);
app.route('/api/earnings', earningsRoutes);
app.route('/api/earnings-today', earningsTodayRoutes);
app.route('/api/earnings-tomorrow', earningsTomorrowRoutes);
app.route('/api/earnings-next-30-days', earningsNext30DaysRoutes);
app.route('/api/earnings-previous-30-days', earningsPrevious30DaysRoutes);
app.route('/api/earnings-watchlist', earningsWatchlistRoutes);
app.route('/api/watchlist', watchlistRoutes);
app.route('/api/cron', cronRoutes);
app.route('/api/tickers', tickersRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  logger.error('Unhandled API error', { 
    path: c.req.path, 
    method: c.req.method,
    message: err.message 
  }, err);
  
  return c.json({
    error: 'Internal server error',
    message: c.env?.NODE_ENV === 'development' ? err.message : undefined
  }, 500);
});

// Export with scheduled event handler for cron triggers
export default {
  fetch: app.fetch,

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const cronLogger = createLogger('cron-scheduled');
    cronLogger.info('Cron trigger fired', { scheduledTime: new Date(event.scheduledTime).toISOString() });

    // Build base URL for internal API calls
    const baseUrl = env.NODE_ENV === 'production'
      ? 'https://tickrtime-api.simons.workers.dev'
      : 'http://localhost:8787';

    const headers = {
      'Content-Type': 'application/json',
      'x-cron-secret': env.CRON_SECRET || '',
    };

    // Run both cron jobs in parallel
    const results = await Promise.allSettled([
      fetch(`${baseUrl}/api/cron/check-alerts`, { method: 'POST', headers }),
      fetch(`${baseUrl}/api/cron/sync-tickers`, { method: 'POST', headers }),
    ]);

    // Log results
    for (const [index, result] of results.entries()) {
      const jobName = index === 0 ? 'check-alerts' : 'sync-tickers';
      if (result.status === 'fulfilled') {
        const response = result.value;
        cronLogger.info(`${jobName} completed`, { status: response.status });
      } else {
        cronLogger.error(`${jobName} failed`, { error: result.reason });
      }
    }
  },
};

