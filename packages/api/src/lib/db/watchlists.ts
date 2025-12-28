import type { D1Database } from '@cloudflare/workers-types';
import { logger } from '../logger';

// Types
export interface WatchlistItem {
  symbol: string;
  addedAt: string;
}

export interface WatchlistData {
  userId: string;
  tickers: WatchlistItem[];
  lastUpdated: string;
}

interface WatchlistRow {
  user_id: string;
  tickers: string; // JSON array stored as string
  last_updated: string;
}

// Convert DB row to application type
function rowToWatchlistData(row: WatchlistRow): WatchlistData {
  let tickers: WatchlistItem[] = [];
  try {
    const parsed = JSON.parse(row.tickers);
    if (Array.isArray(parsed)) {
      if (parsed.length > 0 && typeof parsed[0] === 'string') {
        // Legacy format: convert string[] to WatchlistItem[]
        tickers = parsed.map((symbol: string) => ({
          symbol,
          addedAt: row.last_updated,
        }));
      } else {
        // New format: WatchlistItem[]
        tickers = parsed;
      }
    }
  } catch (error) {
    logger.warn('Failed to parse watchlist tickers JSON:', error);
  }

  return {
    userId: row.user_id,
    tickers,
    lastUpdated: row.last_updated,
  };
}

export async function getWatchlistByUserId(
  db: D1Database,
  userId: string
): Promise<WatchlistData | null> {
  try {
    const result = await db
      .prepare('SELECT * FROM watchlists WHERE user_id = ?')
      .bind(userId)
      .first<WatchlistRow>();

    if (!result) {
      return null;
    }

    return rowToWatchlistData(result);
  } catch (error) {
    logger.error('Error getting watchlist:', error);
    return null;
  }
}

export async function createOrUpdateWatchlist(
  db: D1Database,
  userId: string,
  tickers: WatchlistItem[]
): Promise<boolean> {
  try {
    const now = new Date().toISOString();
    const tickersJson = JSON.stringify(tickers);

    // Use INSERT OR REPLACE for atomic upsert (user_id is PRIMARY KEY)
    const result = await db
      .prepare(
        `INSERT OR REPLACE INTO watchlists (user_id, tickers, last_updated)
         VALUES (?, ?, ?)`
      )
      .bind(userId, tickersJson, now)
      .run();

    return result.success;
  } catch (error) {
    logger.error('Error creating/updating watchlist:', error);
    return false;
  }
}

export async function addTickerToWatchlist(
  db: D1Database,
  userId: string,
  symbol: string
): Promise<{ success: boolean; tickers: WatchlistItem[]; lastUpdated: string }> {
  try {
    const normalizedSymbol = symbol.toUpperCase();
    const now = new Date().toISOString();

    // Get current watchlist
    const existing = await getWatchlistByUserId(db, userId);
    let tickers = existing?.tickers || [];

    // Check if already exists
    if (tickers.some((t) => t.symbol === normalizedSymbol)) {
      return {
        success: true,
        tickers,
        lastUpdated: existing?.lastUpdated || now,
      };
    }

    // Add new ticker
    tickers = [...tickers, { symbol: normalizedSymbol, addedAt: now }];

    const success = await createOrUpdateWatchlist(db, userId, tickers);
    return {
      success,
      tickers: success ? tickers : existing?.tickers || [],
      lastUpdated: now,
    };
  } catch (error) {
    logger.error('Error adding ticker to watchlist:', error);
    return { success: false, tickers: [], lastUpdated: new Date().toISOString() };
  }
}

export async function removeTickerFromWatchlist(
  db: D1Database,
  userId: string,
  symbol: string
): Promise<{ success: boolean; tickers: WatchlistItem[]; lastUpdated: string }> {
  try {
    const normalizedSymbol = symbol.toUpperCase();
    const now = new Date().toISOString();
    const existing = await getWatchlistByUserId(db, userId);

    if (!existing) {
      return { success: true, tickers: [], lastUpdated: now };
    }

    const tickers = existing.tickers.filter((t) => t.symbol !== normalizedSymbol);
    const success = await createOrUpdateWatchlist(db, userId, tickers);

    return {
      success,
      tickers: success ? tickers : existing.tickers,
      lastUpdated: now,
    };
  } catch (error) {
    logger.error('Error removing ticker from watchlist:', error);
    return { success: false, tickers: [], lastUpdated: new Date().toISOString() };
  }
}

export async function deleteWatchlist(
  db: D1Database,
  userId: string
): Promise<boolean> {
  try {
    const result = await db
      .prepare('DELETE FROM watchlists WHERE user_id = ?')
      .bind(userId)
      .run();

    return result.success;
  } catch (error) {
    logger.error('Error deleting watchlist:', error);
    return false;
  }
}
