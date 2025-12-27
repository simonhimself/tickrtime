import { Hono } from 'hono';
import type { Env } from '../index';
import { createLogger } from '../lib/logger';

// Finnhub API response types
interface FinnhubEarningsCalendarItem {
  symbol: string;
  date: string;
  hour?: string;
  quarter?: number;
  year?: number;
  epsActual?: number | string | null;
  epsEstimate?: number | string | null;
  epsSurprise?: number | null;
  epsSurprisePercent?: number | null;
}

interface FinnhubCalendarResponse {
  earningsCalendar?: FinnhubEarningsCalendarItem[];
}

interface WatchlistEarningItem {
  symbol: string;
  date: string | null;
  quarter: number | null;
  year: number | null;
  estimate: number | null;
  actual: number | null;
  surprise: number | null;
  surprisePercent: number | null;
  marketCap: null;
  exchange: null;
  name: null;
}

const app = new Hono<{ Bindings: Env }>();
const logger = createLogger('earnings-watchlist');

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

app.get('/', async (c) => {
  try {
    if (!c.env!.FINNHUB_API_KEY) {
      logger.error('FINNHUB_API_KEY environment variable is not set');
      return c.json({ error: 'API configuration error' }, 500);
    }

    const symbolsParam = c.req.query('symbols');

    if (!symbolsParam) {
      return c.json([]);
    }

    const symbols = symbolsParam.split(',').filter(Boolean);

    if (symbols.length === 0) {
      return c.json([]);
    }

    logger.debug('/api/earnings-watchlist fetching earnings for symbols:', symbols);

    const today = new Date();
    const currentYear = today.getFullYear();
    const fromDate = today.toISOString().split('T')[0]!;
    const toDate = `${currentYear + 1}-12-31`;

    const promises = symbols.map(async (symbol): Promise<WatchlistEarningItem[]> => {
      try {
        const urlParams = new URLSearchParams({
          symbol: symbol.toUpperCase(),
          from: fromDate,
          to: toDate,
          token: c.env!.FINNHUB_API_KEY!,
        });

        const url = `${FINNHUB_BASE_URL}/calendar/earnings?${urlParams.toString()}`;
        const res = await fetch(url);

        if (!res.ok) {
          logger.error(`Failed to fetch earnings for ${symbol}:`, res.status);
          return [];
        }

        const data = await res.json() as FinnhubCalendarResponse;
        const earnings = Array.isArray(data.earningsCalendar) ? data.earningsCalendar : [];

        return earnings.map((item) => ({
          symbol: item.symbol || symbol.toUpperCase(),
          date: item.date,
          quarter: item.quarter ?? null,
          year: item.year ?? null,
          estimate: typeof item.epsEstimate === 'number' ? item.epsEstimate : null,
          actual: typeof item.epsActual === 'number' ? item.epsActual : null,
          surprise: item.epsSurprise ?? null,
          surprisePercent: item.epsSurprisePercent ?? null,
          marketCap: null,
          exchange: null,
          name: null,
        }));
      } catch (error) {
        logger.error(`Error fetching earnings for ${symbol}:`, error);
        return [];
      }
    });

    const results = await Promise.all(promises);

    const allFutureEarnings = results
      .flat()
      .filter((earning): earning is WatchlistEarningItem & { date: string } => {
        if (!earning.date) return false;
        const earningDate = new Date(earning.date);
        return earningDate >= today;
      })
      .sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateA - dateB;
      });

    const earningsByTicker = new Map<string, typeof allFutureEarnings>();

    allFutureEarnings.forEach(earning => {
      const symbol = earning.symbol;
      if (!earningsByTicker.has(symbol)) {
        earningsByTicker.set(symbol, []);
      }
      earningsByTicker.get(symbol)!.push(earning);
    });

    const allEarnings = symbols.map((symbol): WatchlistEarningItem => {
      const tickerEarnings = earningsByTicker.get(symbol.toUpperCase());

      if (tickerEarnings && tickerEarnings.length > 0) {
        return tickerEarnings[0]!;
      } else {
        return {
          symbol: symbol.toUpperCase(),
          date: null,
          quarter: null,
          year: null,
          estimate: null,
          actual: null,
          surprise: null,
          surprisePercent: null,
          marketCap: null,
          exchange: null,
          name: null,
        };
      }
    })
      .sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;

        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateA.getTime() - dateB.getTime();
      });

    return c.json(allEarnings);

  } catch (error) {
    logger.error('/api/earnings-watchlist error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default app;





