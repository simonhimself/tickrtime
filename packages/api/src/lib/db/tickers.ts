import type { D1Database } from '@cloudflare/workers-types';
import { logger } from '../logger';

// Database row types (snake_case, matches SQL schema)
export interface TickerRow {
  symbol: string;
  description: string | null;
  exchange: string;
  industry: string | null;
  sector: string | null;
  is_active: number;
  profile_fetched_at: string | null;
  created_at: string;
  updated_at: string;
}

// Application types (camelCase, used in API responses)
export interface Ticker {
  symbol: string;
  description?: string;
  exchange: string;
  industry?: string;
  sector?: string;
  isActive: boolean;
  profileFetchedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Sector mapping: Finnhub industries → broader sectors
export const SECTOR_MAPPING: Record<string, string> = {
  // Technology
  'Technology': 'Technology',
  'Software': 'Technology',
  'Hardware': 'Technology',
  'Semiconductors': 'Technology',
  'Electronic Components': 'Technology',
  'Computer Hardware': 'Technology',
  'Information Technology Services': 'Technology',

  // Healthcare
  'Healthcare': 'Healthcare',
  'Pharmaceuticals': 'Healthcare',
  'Biotechnology': 'Healthcare',
  'Medical Devices': 'Healthcare',
  'Healthcare Plans': 'Healthcare',
  'Medical Care Facilities': 'Healthcare',
  'Drug Manufacturers': 'Healthcare',
  'Diagnostics & Research': 'Healthcare',
  'Medical Instruments & Supplies': 'Healthcare',

  // Financials
  'Financial Services': 'Financials',
  'Banks': 'Financials',
  'Insurance': 'Financials',
  'Asset Management': 'Financials',
  'Capital Markets': 'Financials',
  'Credit Services': 'Financials',
  'Financial Data & Stock Exchanges': 'Financials',
  'Insurance - Life': 'Financials',
  'Insurance - Property & Casualty': 'Financials',
  'Banks - Regional': 'Financials',
  'Banks - Diversified': 'Financials',

  // Consumer
  'Consumer Cyclical': 'Consumer',
  'Consumer Defensive': 'Consumer',
  'Retail': 'Consumer',
  'Restaurants': 'Consumer',
  'Apparel': 'Consumer',
  'Auto Manufacturers': 'Consumer',
  'Auto Parts': 'Consumer',
  'Leisure': 'Consumer',
  'Packaging & Containers': 'Consumer',
  'Personal Services': 'Consumer',
  'Specialty Retail': 'Consumer',
  'Beverages': 'Consumer',
  'Food Products': 'Consumer',
  'Household Products': 'Consumer',
  'Tobacco': 'Consumer',

  // Industrials
  'Industrials': 'Industrials',
  'Industrial': 'Industrials',
  'Manufacturing': 'Industrials',
  'Aerospace & Defense': 'Industrials',
  'Airlines': 'Industrials',
  'Building Materials': 'Industrials',
  'Construction': 'Industrials',
  'Farm & Heavy Construction Machinery': 'Industrials',
  'Industrial Distribution': 'Industrials',
  'Waste Management': 'Industrials',
  'Trucking': 'Industrials',
  'Railroads': 'Industrials',
  'Marine Shipping': 'Industrials',

  // Energy
  'Energy': 'Energy',
  'Oil & Gas': 'Energy',
  'Oil & Gas E&P': 'Energy',
  'Oil & Gas Integrated': 'Energy',
  'Oil & Gas Midstream': 'Energy',
  'Oil & Gas Refining & Marketing': 'Energy',
  'Oil & Gas Equipment & Services': 'Energy',

  // Utilities
  'Utilities': 'Utilities',
  'Utilities - Regulated Electric': 'Utilities',
  'Utilities - Regulated Gas': 'Utilities',
  'Utilities - Diversified': 'Utilities',
  'Utilities - Renewable': 'Utilities',
  'Utilities - Independent Power Producers': 'Utilities',

  // Real Estate
  'Real Estate': 'Real Estate',
  'REIT': 'Real Estate',
  'REIT - Retail': 'Real Estate',
  'REIT - Residential': 'Real Estate',
  'REIT - Office': 'Real Estate',
  'REIT - Healthcare Facilities': 'Real Estate',
  'REIT - Industrial': 'Real Estate',
  'REIT - Diversified': 'Real Estate',
  'Real Estate Services': 'Real Estate',
  'Real Estate Development': 'Real Estate',

  // Communication
  'Communication Services': 'Communication',
  'Communication': 'Communication',
  'Media': 'Communication',
  'Telecom Services': 'Communication',
  'Entertainment': 'Communication',
  'Advertising Agencies': 'Communication',
  'Broadcasting': 'Communication',
  'Internet Content & Information': 'Communication',
  'Electronic Gaming & Multimedia': 'Communication',

  // Materials
  'Basic Materials': 'Materials',
  'Materials': 'Materials',
  'Chemicals': 'Materials',
  'Steel': 'Materials',
  'Aluminum': 'Materials',
  'Copper': 'Materials',
  'Gold': 'Materials',
  'Silver': 'Materials',
  'Lumber & Wood Production': 'Materials',
  'Paper & Paper Products': 'Materials',
  'Specialty Chemicals': 'Materials',
};

// Map Finnhub industry to broader sector
export function mapIndustryToSector(industry: string | null | undefined): string | undefined {
  if (!industry) return undefined;
  return SECTOR_MAPPING[industry] ?? 'Other';
}

// Convert database row to application type
function rowToTicker(row: TickerRow): Ticker {
  return {
    symbol: row.symbol,
    description: row.description ?? undefined,
    exchange: row.exchange,
    industry: row.industry ?? undefined,
    sector: row.sector ?? undefined,
    isActive: row.is_active === 1,
    profileFetchedAt: row.profile_fetched_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Get all active ticker symbols as a Set (for efficient filtering)
export async function getActiveSymbols(db: D1Database): Promise<Set<string>> {
  try {
    const result = await db
      .prepare('SELECT symbol FROM tickers WHERE is_active = 1')
      .all<{ symbol: string }>();

    if (!result.success || !result.results) {
      return new Set();
    }

    return new Set(result.results.map((r) => r.symbol));
  } catch (error) {
    logger.error('Error getting active symbols:', error);
    return new Set();
  }
}

// Get ticker metadata as a Map for efficient lookups
export async function getTickerMetadataMap(db: D1Database): Promise<Map<string, Ticker>> {
  try {
    const result = await db
      .prepare('SELECT * FROM tickers WHERE is_active = 1')
      .all<TickerRow>();

    if (!result.success || !result.results) {
      return new Map();
    }

    const map = new Map<string, Ticker>();
    for (const row of result.results) {
      map.set(row.symbol, rowToTicker(row));
    }
    return map;
  } catch (error) {
    logger.error('Error getting ticker metadata map:', error);
    return new Map();
  }
}

// Get a single ticker by symbol
export async function getTickerBySymbol(db: D1Database, symbol: string): Promise<Ticker | null> {
  try {
    const result = await db
      .prepare('SELECT * FROM tickers WHERE symbol = ?')
      .bind(symbol.toUpperCase())
      .first<TickerRow>();

    if (!result) {
      return null;
    }

    return rowToTicker(result);
  } catch (error) {
    logger.error('Error getting ticker by symbol:', error);
    return null;
  }
}

// Get tickers with optional filtering
export async function getTickersFiltered(
  db: D1Database,
  filters: {
    sector?: string;
    industry?: string;
    exchange?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<Ticker[]> {
  try {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (filters.sector) {
      conditions.push('sector = ?');
      values.push(filters.sector);
    }
    if (filters.industry) {
      conditions.push('industry = ?');
      values.push(filters.industry);
    }
    if (filters.exchange) {
      conditions.push('exchange = ?');
      values.push(filters.exchange);
    }
    if (filters.isActive !== undefined) {
      conditions.push('is_active = ?');
      values.push(filters.isActive ? 1 : 0);
    }

    let query = 'SELECT * FROM tickers';
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY symbol ASC';

    if (filters.limit) {
      query += ' LIMIT ?';
      values.push(filters.limit);
    }
    if (filters.offset) {
      query += ' OFFSET ?';
      values.push(filters.offset);
    }

    const result = await db.prepare(query).bind(...values).all<TickerRow>();

    if (!result.success || !result.results) {
      return [];
    }

    return result.results.map(rowToTicker);
  } catch (error) {
    logger.error('Error getting filtered tickers:', error);
    return [];
  }
}

// Get distinct sectors for filtering dropdown
export async function getDistinctSectors(db: D1Database): Promise<string[]> {
  try {
    const result = await db
      .prepare(
        'SELECT DISTINCT sector FROM tickers WHERE sector IS NOT NULL AND is_active = 1 ORDER BY sector ASC'
      )
      .all<{ sector: string }>();

    if (!result.success || !result.results) {
      return [];
    }

    return result.results.map((r) => r.sector);
  } catch (error) {
    logger.error('Error getting distinct sectors:', error);
    return [];
  }
}

// Get distinct industries for filtering
export async function getDistinctIndustries(db: D1Database, sector?: string): Promise<string[]> {
  try {
    let query = 'SELECT DISTINCT industry FROM tickers WHERE industry IS NOT NULL AND is_active = 1';
    const values: unknown[] = [];

    if (sector) {
      query += ' AND sector = ?';
      values.push(sector);
    }

    query += ' ORDER BY industry ASC';

    const result = await db.prepare(query).bind(...values).all<{ industry: string }>();

    if (!result.success || !result.results) {
      return [];
    }

    return result.results.map((r) => r.industry);
  } catch (error) {
    logger.error('Error getting distinct industries:', error);
    return [];
  }
}

// Insert or update a ticker (upsert)
export async function upsertTicker(
  db: D1Database,
  ticker: {
    symbol: string;
    description?: string;
    exchange: string;
    industry?: string;
    sector?: string;
    isActive?: boolean;
    profileFetchedAt?: string;
  }
): Promise<boolean> {
  try {
    const now = new Date().toISOString();

    const result = await db
      .prepare(
        `INSERT INTO tickers (symbol, description, exchange, industry, sector, is_active, profile_fetched_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(symbol) DO UPDATE SET
           description = COALESCE(excluded.description, tickers.description),
           exchange = excluded.exchange,
           industry = COALESCE(excluded.industry, tickers.industry),
           sector = COALESCE(excluded.sector, tickers.sector),
           is_active = excluded.is_active,
           profile_fetched_at = COALESCE(excluded.profile_fetched_at, tickers.profile_fetched_at),
           updated_at = excluded.updated_at`
      )
      .bind(
        ticker.symbol.toUpperCase(),
        ticker.description ?? null,
        ticker.exchange,
        ticker.industry ?? null,
        ticker.sector ?? null,
        ticker.isActive !== false ? 1 : 0,
        ticker.profileFetchedAt ?? null,
        now,
        now
      )
      .run();

    return result.success && result.meta.changes > 0;
  } catch (error) {
    logger.error('Error upserting ticker:', error);
    return false;
  }
}

// Bulk insert tickers (for initial population)
export async function bulkInsertTickers(
  db: D1Database,
  tickers: Array<{
    symbol: string;
    description?: string;
    exchange: string;
  }>
): Promise<{ inserted: number; failed: number }> {
  const now = new Date().toISOString();
  let inserted = 0;
  let failed = 0;

  // D1 supports batch operations
  const statements = tickers.map((ticker) =>
    db
      .prepare(
        `INSERT OR IGNORE INTO tickers (symbol, description, exchange, is_active, created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, ?)`
      )
      .bind(
        ticker.symbol.toUpperCase(),
        ticker.description ?? null,
        ticker.exchange,
        now,
        now
      )
  );

  try {
    // Execute in batches of 100 (D1 limit)
    const BATCH_SIZE = 100;
    for (let i = 0; i < statements.length; i += BATCH_SIZE) {
      const batch = statements.slice(i, i + BATCH_SIZE);
      const results = await db.batch(batch);

      for (const result of results) {
        if (result.success && result.meta.changes > 0) {
          inserted++;
        } else {
          failed++;
        }
      }
    }
  } catch (error) {
    logger.error('Error in bulk insert:', error);
    failed = tickers.length - inserted;
  }

  return { inserted, failed };
}

// Update ticker with profile data (industry enrichment)
export async function updateTickerProfile(
  db: D1Database,
  symbol: string,
  profile: {
    industry?: string;
    sector?: string;
  }
): Promise<boolean> {
  try {
    const now = new Date().toISOString();

    const result = await db
      .prepare(
        `UPDATE tickers SET
           industry = ?,
           sector = ?,
           profile_fetched_at = ?,
           updated_at = ?
         WHERE symbol = ?`
      )
      .bind(
        profile.industry ?? null,
        profile.sector ?? null,
        now,
        now,
        symbol  // Keep original case - some symbols have mixed case (e.g., FLGpU)
      )
      .run();

    return result.success && result.meta.changes > 0;
  } catch (error) {
    logger.error('Error updating ticker profile:', error);
    return false;
  }
}

// Mark ticker as inactive (for delistings)
export async function markTickerInactive(db: D1Database, symbol: string): Promise<boolean> {
  try {
    const now = new Date().toISOString();

    const result = await db
      .prepare('UPDATE tickers SET is_active = 0, updated_at = ? WHERE symbol = ?')
      .bind(now, symbol.toUpperCase())
      .run();

    return result.success && result.meta.changes > 0;
  } catch (error) {
    logger.error('Error marking ticker inactive:', error);
    return false;
  }
}

// Get unenriched tickers (no profile data yet, or failed tickers due for retry)
// Retries tickers with industry=NULL after 30 days in case Finnhub adds data later
export async function getUnenrichedTickers(db: D1Database, limit: number = 50): Promise<Ticker[]> {
  try {
    const result = await db
      .prepare(
        `SELECT * FROM tickers
         WHERE is_active = 1
           AND (
             profile_fetched_at IS NULL
             OR (industry IS NULL AND profile_fetched_at < datetime('now', '-30 days'))
           )
         ORDER BY profile_fetched_at NULLS FIRST, symbol ASC
         LIMIT ?`
      )
      .bind(limit)
      .all<TickerRow>();

    if (!result.success || !result.results) {
      return [];
    }

    return result.results.map(rowToTicker);
  } catch (error) {
    logger.error('Error getting unenriched tickers:', error);
    return [];
  }
}

// Count total tickers
export async function getTickerCount(
  db: D1Database,
  filters?: { isActive?: boolean; hasProfile?: boolean }
): Promise<number> {
  try {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (filters?.isActive !== undefined) {
      conditions.push('is_active = ?');
      values.push(filters.isActive ? 1 : 0);
    }
    if (filters?.hasProfile !== undefined) {
      if (filters.hasProfile) {
        conditions.push('profile_fetched_at IS NOT NULL');
      } else {
        conditions.push('profile_fetched_at IS NULL');
      }
    }

    let query = 'SELECT COUNT(*) as count FROM tickers';
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    const result = await db.prepare(query).bind(...values).first<{ count: number }>();

    return result?.count ?? 0;
  } catch (error) {
    logger.error('Error getting ticker count:', error);
    return 0;
  }
}
