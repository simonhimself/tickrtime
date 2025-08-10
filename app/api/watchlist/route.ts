import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getWatchlist, addTickerToWatchlist, removeTickerFromWatchlist, createDevKV } from '@/lib/kv-dev';
import type { WatchlistApiResponse } from '@/types';

// Helper function to get user from token
async function getUserFromToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  return verifyToken(token);
}

// GET - Get user's watchlist
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json<WatchlistApiResponse>({
        success: false,
        message: 'Unauthorized'
      }, { status: 401 });
    }

    // Get KV namespace (use development KV for now)
    const kv = createDevKV();

    // Get watchlist
    const watchlist = await getWatchlist(kv, user.userId);

    return NextResponse.json<WatchlistApiResponse>({
      success: true,
      message: 'Watchlist retrieved successfully',
      watchlist: {
        tickers: watchlist.tickers.map(symbol => ({ symbol, addedAt: watchlist.lastUpdated })),
        lastUpdated: watchlist.lastUpdated
      },
      tickers: watchlist.tickers
    });

  } catch (error) {
    console.error('Get watchlist error:', error);
    return NextResponse.json<WatchlistApiResponse>({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}

// POST - Add ticker to watchlist
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json<WatchlistApiResponse>({
        success: false,
        message: 'Unauthorized'
      }, { status: 401 });
    }

    const body = await request.json();
    const { symbol } = body;

    if (!symbol) {
      return NextResponse.json<WatchlistApiResponse>({
        success: false,
        message: 'Symbol is required'
      }, { status: 400 });
    }

    // Get KV namespace (use development KV for now)
    const kv = createDevKV();

    // Add ticker to watchlist
    const success = await addTickerToWatchlist(kv, user.userId, symbol);
    if (!success) {
      return NextResponse.json<WatchlistApiResponse>({
        success: false,
        message: 'Failed to add ticker to watchlist'
      }, { status: 500 });
    }

    // Get updated watchlist
    const watchlist = await getWatchlist(kv, user.userId);

    return NextResponse.json<WatchlistApiResponse>({
      success: true,
      message: `${symbol.toUpperCase()} added to watchlist`,
      watchlist: {
        tickers: watchlist.tickers.map(s => ({ symbol: s, addedAt: watchlist.lastUpdated })),
        lastUpdated: watchlist.lastUpdated
      },
      tickers: watchlist.tickers
    });

  } catch (error) {
    console.error('Add to watchlist error:', error);
    return NextResponse.json<WatchlistApiResponse>({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}

// DELETE - Remove ticker from watchlist
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json<WatchlistApiResponse>({
        success: false,
        message: 'Unauthorized'
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json<WatchlistApiResponse>({
        success: false,
        message: 'Symbol is required'
      }, { status: 400 });
    }

    // Get KV namespace (use development KV for now)
    const kv = createDevKV();

    // Remove ticker from watchlist
    const success = await removeTickerFromWatchlist(kv, user.userId, symbol);
    if (!success) {
      return NextResponse.json<WatchlistApiResponse>({
        success: false,
        message: 'Failed to remove ticker from watchlist'
      }, { status: 500 });
    }

    // Get updated watchlist
    const watchlist = await getWatchlist(kv, user.userId);

    return NextResponse.json<WatchlistApiResponse>({
      success: true,
      message: `${symbol.toUpperCase()} removed from watchlist`,
      watchlist: {
        tickers: watchlist.tickers.map(s => ({ symbol: s, addedAt: watchlist.lastUpdated })),
        lastUpdated: watchlist.lastUpdated
      },
      tickers: watchlist.tickers
    });

  } catch (error) {
    console.error('Remove from watchlist error:', error);
    return NextResponse.json<WatchlistApiResponse>({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}
