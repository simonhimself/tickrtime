import { Hono } from 'hono';
import type { Env } from '../index';
import { createLogger } from '../lib/logger';
import { createDB } from '../lib/db';
import {
  getTickerBySymbol,
  getDistinctSectors,
  type Ticker,
} from '../lib/db/tickers';
import { useDbTickers, getTickerMetadata } from '../lib/ticker-data';

const app = new Hono<{ Bindings: Env }>();
const logger = createLogger('tickers');

// GET /api/tickers - List tickers with optional filters
app.get('/', async (c) => {
  try {
    const db = createDB(c.env!);
    const sector = c.req.query('sector');
    const search = c.req.query('search');
    const limit = parseInt(c.req.query('limit') || '100');
    const offset = parseInt(c.req.query('offset') || '0');

    // For now, only support D1 queries when USE_DB_TICKERS is enabled
    if (!useDbTickers(c.env!)) {
      // Fallback to returning a message that D1 is not enabled
      return c.json({
        message: 'Ticker API requires USE_DB_TICKERS=true',
        tickers: [],
        total: 0,
      });
    }

    // Build query with filters
    let query = 'SELECT * FROM tickers WHERE is_active = 1';
    const params: (string | number)[] = [];

    if (sector) {
      query += ' AND sector = ?';
      params.push(sector);
    }

    if (search) {
      query += ' AND (symbol LIKE ? OR description LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = await db.prepare(countQuery).bind(...params).first<{ count: number }>();
    const total = countResult?.count || 0;

    // Add pagination
    query += ' ORDER BY symbol ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const results = await db.prepare(query).bind(...params).all<Ticker>();
    const tickers = results.results || [];

    return c.json({
      tickers,
      total,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('Error fetching tickers:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/tickers/sectors - List distinct sectors for dropdown
app.get('/sectors', async (c) => {
  try {
    const db = createDB(c.env!);

    if (!useDbTickers(c.env!)) {
      // Return hardcoded sectors from the legacy JSON (all were Technology)
      return c.json({
        sectors: ['Technology'],
      });
    }

    const sectors = await getDistinctSectors(db);

    return c.json({
      sectors,
    });
  } catch (error) {
    logger.error('Error fetching sectors:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/tickers/:symbol - Get single ticker metadata
app.get('/:symbol', async (c) => {
  try {
    const symbol = c.req.param('symbol').toUpperCase();
    const db = createDB(c.env!);

    if (useDbTickers(c.env!)) {
      const ticker = await getTickerBySymbol(db, symbol);

      if (!ticker) {
        return c.json({ error: 'Ticker not found' }, 404);
      }

      return c.json(ticker);
    } else {
      // Fallback to legacy JSON lookup
      const tickerMetadata = await getTickerMetadata(db, c.env!);
      const ticker = tickerMetadata.get(symbol);

      if (!ticker) {
        return c.json({ error: 'Ticker not found' }, 404);
      }

      return c.json({
        symbol,
        description: ticker.description,
        exchange: ticker.exchange,
        industry: ticker.industry,
        sector: ticker.sector,
        is_active: 1,
      });
    }
  } catch (error) {
    logger.error('Error fetching ticker:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default app;
