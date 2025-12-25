import { getRequestContext } from '@cloudflare/next-on-pages';
import { logger } from '@/lib/logger';

// Note: better-sqlite3 cannot be used in Edge runtime
// For development, use `wrangler dev` which provides D1 bindings
// For production, Cloudflare Pages provides D1 bindings automatically

// Declare Cloudflare D1 database type
declare global {
  interface CloudflareEnv {
    DB: D1Database;
  }
}

// D1 Database interface (matches Cloudflare's D1 API)
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): D1ExecResult;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

export interface D1Result<T = unknown> {
  success: boolean;
  meta: {
    duration: number;
    rows_read: number;
    rows_written: number;
    last_row_id: number;
    changed_db: boolean;
    changes: number;
  };
  results?: T[];
}

export interface D1ExecResult {
  count: number;
  duration: number;
}

// Note: We cannot use better-sqlite3 in Edge runtime
// The dev database fallback is not available when running in Edge runtime
// Users must use `wrangler dev` for local development with D1

// Create D1 database instance based on environment
export function createDB(): D1Database {
  // Check for test environment mock first
  if (typeof globalThis !== 'undefined' && (globalThis as any).__TEST_DB__) {
    return (globalThis as any).__TEST_DB__;
  }

  try {
    // Try to get D1 database from Cloudflare request context
    const { env } = getRequestContext();
    const db = env.DB;

    if (db) {
      logger.debug('Using Cloudflare D1 database from request context');
      return db;
    }
  } catch {
    // getRequestContext() throws if not in Cloudflare context
    logger.debug('Not in Cloudflare context, checking globalThis');
  }

  // Fallback: Check globalThis (for production deployment)
  const db = (globalThis as Record<string, unknown>).DB as D1Database | undefined;

  if (db) {
    logger.debug('Using Cloudflare D1 database from globalThis');
    return db;
  }

  // No D1 database available
  // In Edge runtime (npm run dev), we can't use SQLite
  // User must use wrangler dev for D1 support
  logger.error('D1 database not available in this environment.');
  logger.error('For local development, please use: npx wrangler dev');
  logger.error('This provides D1 database bindings and runs on http://localhost:8787');
  throw new Error(
    'D1 database not available. ' +
    'Please use "npx wrangler dev" instead of "npm run dev" to run the development server with D1 support. ' +
    'See DEVELOPMENT.md for more information.'
  );
}

