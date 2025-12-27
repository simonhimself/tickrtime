/**
 * Ticker Data Helper
 *
 * This module provides a unified interface for accessing ticker data,
 * supporting both the legacy JSON file and the new D1 database.
 *
 * Feature flag: USE_DB_TICKERS environment variable
 *   - 'true': Use D1 database (new system)
 *   - 'false' or undefined: Use static JSON file (legacy)
 */

import type { D1Database } from '@cloudflare/workers-types';
import {
  getActiveSymbols as getActiveSymbolsFromDb,
  getTickerMetadataMap as getTickerMetadataMapFromDb,
} from './db/tickers';

// Import static JSON for legacy mode
import techTickers from '../../data/tech_tickers.json';

export interface TickerMetadata {
  symbol: string;
  description?: string;
  exchange?: string;
  industry?: string;
  sector?: string;
}

interface TechTickerItem {
  symbol: string;
  description?: string;
  exchange?: string;
  finnhubIndustry?: string;
}

/**
 * Check if D1 tickers feature is enabled
 */
export function useDbTickers(env: { USE_DB_TICKERS?: string }): boolean {
  return env.USE_DB_TICKERS === 'true';
}

/**
 * Get all active ticker symbols
 * Returns a Set for efficient O(1) lookups during filtering
 */
export async function getActiveTickerSymbols(
  db: D1Database,
  env: { USE_DB_TICKERS?: string }
): Promise<Set<string>> {
  if (useDbTickers(env)) {
    return getActiveSymbolsFromDb(db);
  }

  // Legacy: use static JSON
  return new Set((techTickers as TechTickerItem[]).map((t) => t.symbol));
}

/**
 * Get ticker metadata as a Map for efficient lookups
 */
export async function getTickerMetadata(
  db: D1Database,
  env: { USE_DB_TICKERS?: string }
): Promise<Map<string, TickerMetadata>> {
  if (useDbTickers(env)) {
    const dbMap = await getTickerMetadataMapFromDb(db);
    // Convert Ticker to TickerMetadata
    const result = new Map<string, TickerMetadata>();
    for (const [symbol, ticker] of dbMap) {
      result.set(symbol, {
        symbol: ticker.symbol,
        description: ticker.description,
        exchange: ticker.exchange,
        industry: ticker.industry,
        sector: ticker.sector,
      });
    }
    return result;
  }

  // Legacy: use static JSON
  const result = new Map<string, TickerMetadata>();
  for (const ticker of techTickers as TechTickerItem[]) {
    result.set(ticker.symbol, {
      symbol: ticker.symbol,
      description: ticker.description,
      exchange: ticker.exchange,
      industry: ticker.finnhubIndustry,
      sector: ticker.finnhubIndustry === 'Technology' ? 'Technology' : undefined,
    });
  }
  return result;
}

/**
 * Get tickers as an array (for compatibility with existing processEarningsData functions)
 */
export async function getTickersArray(
  db: D1Database,
  env: { USE_DB_TICKERS?: string }
): Promise<TickerMetadata[]> {
  const map = await getTickerMetadata(db, env);
  return Array.from(map.values());
}
