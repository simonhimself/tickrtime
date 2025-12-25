import type { D1Database } from '@cloudflare/workers-types';
import { logger } from './logger';

// Simplified database access - Worker has direct access to env.DB
export function createDB(env: { DB: D1Database }): D1Database {
  if (!env.DB) {
    logger.error('D1 database not available in environment');
    throw new Error('D1 database not available');
  }
  return env.DB;
}


