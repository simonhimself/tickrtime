import { Hono } from 'hono';
import type { Env } from '../index';
import { createLogger } from '../lib/logger';
import { verifyToken } from '../lib/auth';
import {
  getWatchlistByUserId,
  addTickerToWatchlist,
  removeTickerFromWatchlist,
} from '../lib/db/watchlists';

const app = new Hono<{ Bindings: Env }>();
const logger = createLogger('watchlist');

// Helper function to get user from token
async function getUserFromToken(
  c: { req: { header: (name: string) => string | undefined }; env?: Env }
): Promise<{ userId: string; email: string } | null> {
  const authHeader = c.req.header('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  return await verifyToken(token, c.env!.JWT_SECRET);
}

// GET /api/watchlist - Get user's watchlist
app.get('/', async (c) => {
  try {
    const user = await getUserFromToken(c);
    if (!user) {
      return c.json({
        success: false,
        message: 'Unauthorized'
      }, 401);
    }

    const watchlist = await getWatchlistByUserId(c.env!.DB, user.userId);
    const tickers = watchlist?.tickers || [];
    const lastUpdated = watchlist?.lastUpdated || new Date().toISOString();

    return c.json({
      success: true,
      message: 'Watchlist retrieved successfully',
      watchlist: {
        tickers,
        lastUpdated,
      },
      tickers: tickers.map((t) => t.symbol), // legacy flat array for compatibility
    });

  } catch (error) {
    logger.error('Get watchlist error:', error);
    return c.json({
      success: false,
      message: 'Internal server error'
    }, 500);
  }
});

// POST /api/watchlist - Add ticker to watchlist
app.post('/', async (c) => {
  try {
    const user = await getUserFromToken(c);
    if (!user) {
      return c.json({
        success: false,
        message: 'Unauthorized'
      }, 401);
    }

    const body = await c.req.json();
    const { symbol } = body;

    if (!symbol) {
      return c.json({
        success: false,
        message: 'Symbol is required'
      }, 400);
    }

    const normalizedSymbol = symbol.toUpperCase();
    const result = await addTickerToWatchlist(c.env!.DB, user.userId, normalizedSymbol);

    if (!result.success) {
      return c.json({
        success: false,
        message: 'Failed to add ticker to watchlist'
      }, 500);
    }

    return c.json({
      success: true,
      message: `${normalizedSymbol} added to watchlist`,
      watchlist: {
        tickers: result.tickers,
        lastUpdated: result.lastUpdated,
      },
      tickers: result.tickers.map((t) => t.symbol),
    });

  } catch (error) {
    logger.error('Add to watchlist error:', error);
    return c.json({
      success: false,
      message: 'Internal server error'
    }, 500);
  }
});

// DELETE /api/watchlist - Remove ticker from watchlist
app.delete('/', async (c) => {
  try {
    const user = await getUserFromToken(c);
    if (!user) {
      return c.json({
        success: false,
        message: 'Unauthorized'
      }, 401);
    }

    const symbol = c.req.query('symbol');

    if (!symbol) {
      return c.json({
        success: false,
        message: 'Symbol is required'
      }, 400);
    }

    const normalizedSymbol = symbol.toUpperCase();
    const result = await removeTickerFromWatchlist(c.env!.DB, user.userId, normalizedSymbol);

    if (!result.success) {
      return c.json({
        success: false,
        message: 'Failed to remove ticker from watchlist'
      }, 500);
    }

    return c.json({
      success: true,
      message: `${normalizedSymbol} removed from watchlist`,
      watchlist: {
        tickers: result.tickers,
        lastUpdated: result.lastUpdated,
      },
      tickers: result.tickers.map((t) => t.symbol),
    });

  } catch (error) {
    logger.error('Remove from watchlist error:', error);
    return c.json({
      success: false,
      message: 'Internal server error'
    }, 500);
  }
});

export default app;
