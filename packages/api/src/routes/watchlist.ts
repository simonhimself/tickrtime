import { Hono } from 'hono';
import type { Env } from '../index';
import { createLogger } from '../lib/logger';
import { verifyToken } from '../lib/auth';
import { createDB } from '../lib/db';

const app = new Hono<{ Bindings: Env }>();
const logger = createLogger('watchlist');

const KV_KEYS = {
  WATCHLIST: 'watchlist:',
} as const;

// Helper function to get user from token
async function getUserFromToken(c: any): Promise<{ userId: string; email: string } | null> {
  const authHeader = c.req.header('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  return await verifyToken(token, c.env!.JWT_SECRET);
}

// Get watchlist from KV
async function getWatchlist(kv: any, userId: string) {
  try {
    const watchlistData = await kv.get(KV_KEYS.WATCHLIST + userId);
    if (watchlistData) {
      return JSON.parse(watchlistData);
    }
    
    return {
      tickers: [],
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Error getting watchlist:', error);
    return {
      tickers: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}

// Save watchlist to KV
async function saveWatchlist(kv: any, userId: string, watchlist: any): Promise<boolean> {
  try {
    watchlist.lastUpdated = new Date().toISOString();
    await kv.put(KV_KEYS.WATCHLIST + userId, JSON.stringify(watchlist));
    return true;
  } catch (error) {
    logger.error('Error saving watchlist:', error);
    return false;
  }
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

    const watchlist = await getWatchlist(c.env!.TICKRTIME_KV, user.userId);

    return c.json({
      success: true,
      message: 'Watchlist retrieved successfully',
      watchlist: {
        tickers: watchlist.tickers.map((symbol: string) => ({ symbol, addedAt: watchlist.lastUpdated })),
        lastUpdated: watchlist.lastUpdated
      },
      tickers: watchlist.tickers
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

    const watchlist = await getWatchlist(c.env!.TICKRTIME_KV, user.userId);
    const normalizedSymbol = symbol.toUpperCase();

    if (!watchlist.tickers.includes(normalizedSymbol)) {
      watchlist.tickers.push(normalizedSymbol);
      const success = await saveWatchlist(c.env!.TICKRTIME_KV, user.userId, watchlist);
      if (!success) {
        return c.json({
          success: false,
          message: 'Failed to add ticker to watchlist'
        }, 500);
      }
    }

    const updatedWatchlist = await getWatchlist(c.env!.TICKRTIME_KV, user.userId);

    return c.json({
      success: true,
      message: `${normalizedSymbol} added to watchlist`,
      watchlist: {
        tickers: updatedWatchlist.tickers.map((s: string) => ({ symbol: s, addedAt: updatedWatchlist.lastUpdated })),
        lastUpdated: updatedWatchlist.lastUpdated
      },
      tickers: updatedWatchlist.tickers
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

    const watchlist = await getWatchlist(c.env!.TICKRTIME_KV, user.userId);
    const normalizedSymbol = symbol.toUpperCase();

    watchlist.tickers = watchlist.tickers.filter((ticker: string) => ticker !== normalizedSymbol);
    const success = await saveWatchlist(c.env!.TICKRTIME_KV, user.userId, watchlist);
    if (!success) {
      return c.json({
        success: false,
        message: 'Failed to remove ticker from watchlist'
      }, 500);
    }

    const updatedWatchlist = await getWatchlist(c.env!.TICKRTIME_KV, user.userId);

    return c.json({
      success: true,
      message: `${normalizedSymbol} removed from watchlist`,
      watchlist: {
        tickers: updatedWatchlist.tickers.map((s: string) => ({ symbol: s, addedAt: updatedWatchlist.lastUpdated })),
        lastUpdated: updatedWatchlist.lastUpdated
      },
      tickers: updatedWatchlist.tickers
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





