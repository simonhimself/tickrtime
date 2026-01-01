import { Hono } from 'hono';
import type { Env } from '../index';
import { createLogger } from '../lib/logger';
import { createDB } from '../lib/db';
import { getActiveTickerSymbols, getTickerMetadata, type TickerMetadata } from '../lib/ticker-data';
import { parseEPS, calculateSurprise } from '../lib/earnings-utils';

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

interface FinnhubSymbolEarningsItem {
  symbol: string;
  period?: string;
  quarter?: number;
  year?: number;
  actual?: number | string | null;
  estimate?: number | string | null;
  surprise?: number | string | null;
  surprisePercent?: number | string | null;
}

interface ProcessedEarning {
  symbol: string;
  date: string;
  actual: number | null;
  estimate: number | null;
  surprise: number | null;
  surprisePercent: number | null;
  hour?: string;
  quarter?: number;
  year?: number;
  exchange?: string;
  description?: string;
  industry?: string;
  sector?: string;
}

const app = new Hono<{ Bindings: Env }>();
const logger = createLogger('earnings');

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

// Helper function to process earnings data
function processEarningsData(
  earnings: FinnhubEarningsCalendarItem[],
  activeSymbols: Set<string>,
  tickerMetadata: Map<string, TickerMetadata>
): ProcessedEarning[] {
  return earnings
    .filter((e) => activeSymbols.has(e.symbol))
    .map((e) => {
      const actual = parseEPS(e.epsActual);
      const estimate = parseEPS(e.epsEstimate);
      const { surprise, surprisePercent } = calculateSurprise(actual, estimate);

      const ticker = tickerMetadata.get(e.symbol);

      return {
        symbol: e.symbol,
        date: e.date,
        actual,
        estimate,
        surprise,
        surprisePercent,
        hour: e.hour,
        quarter: e.quarter,
        year: e.year,
        exchange: ticker?.exchange,
        description: ticker?.description,
        industry: ticker?.industry,
        sector: ticker?.sector,
      };
    });
}

// GET /api/earnings - Search earnings by symbol
app.get('/', async (c) => {
  try {
    const symbol = c.req.query('symbol');
    const year = c.req.query('year');
    const quarter = c.req.query('quarter');

    if (!c.env!.FINNHUB_API_KEY) {
      logger.error('FINNHUB_API_KEY environment variable is not set');
      return c.json({ error: 'API configuration error' }, 500);
    }

    if (!symbol) {
      return c.json({ error: 'Missing symbol parameter' }, 400);
    }

    // Get ticker metadata (from D1 or JSON based on feature flag)
    const db = createDB(c.env!);
    const tickerMetadata = await getTickerMetadata(db, c.env!);

    const url = `${FINNHUB_BASE_URL}/stock/earnings?symbol=${symbol.toUpperCase()}&token=${c.env!.FINNHUB_API_KEY}`;
    logger.debug('Finnhub API URL:', url.replace(c.env!.FINNHUB_API_KEY, '***'));

    const res = await fetch(url);
    if (!res.ok) {
      logger.error('Finnhub fetch failed:', res.status, res.statusText);
      return c.json({ error: 'Failed to fetch from Finnhub' }, 500);
    }

    const data = await res.json() as FinnhubSymbolEarningsItem[] | null;
    logger.debug('Finnhub response received for symbol:', symbol);

    let earnings: FinnhubSymbolEarningsItem[] = Array.isArray(data) ? data : [];

    // Filter by year if provided
    if (year) {
      earnings = earnings.filter((e) => e.year === parseInt(year));
    }

    // Filter by quarter if provided
    if (quarter) {
      earnings = earnings.filter((e) => e.quarter === parseInt(quarter));
    }

    const result = earnings.map((e) => {
      const ticker = tickerMetadata.get(e.symbol);

      return {
        symbol: e.symbol,
        date: e.period || '',
        actual: typeof e.actual === 'number' ? e.actual : (e.actual ? parseFloat(String(e.actual)) : null),
        estimate: typeof e.estimate === 'number' ? e.estimate : (e.estimate ? parseFloat(String(e.estimate)) : null),
        surprise: typeof e.surprise === 'number' ? e.surprise : (e.surprise ? parseFloat(String(e.surprise)) : null),
        surprisePercent: typeof e.surprisePercent === 'number'
          ? e.surprisePercent
          : (e.surprisePercent ? parseFloat(String(e.surprisePercent)) : null),
        hour: undefined,
        quarter: e.quarter,
        year: e.year,
        exchange: ticker?.exchange,
        description: ticker?.description,
        industry: ticker?.industry,
        sector: ticker?.sector,
      };
    });

    return c.json({
      earnings: result,
      totalFound: result.length,
    });
  } catch (error) {
    logger.error('Error fetching earnings:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/earnings-today
app.get('/today', async (c) => {
  try {
    if (!c.env!.FINNHUB_API_KEY) {
      logger.error('FINNHUB_API_KEY environment variable is not set');
      return c.json({ error: 'API configuration error' }, 500);
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]!;

    logger.debug('/api/earnings-today date:', todayStr);

    // Get ticker data (from D1 or JSON based on feature flag)
    const db = createDB(c.env!);
    const [activeSymbols, tickerMetadata] = await Promise.all([
      getActiveTickerSymbols(db, c.env!),
      getTickerMetadata(db, c.env!),
    ]);

    const url = `${FINNHUB_BASE_URL}/calendar/earnings?from=${todayStr}&to=${todayStr}&token=${c.env!.FINNHUB_API_KEY}`;

    const res = await fetch(url);
    if (!res.ok) {
      logger.error('Finnhub fetch failed:', res.status, res.statusText);
      return c.json({ error: 'Failed to fetch from Finnhub' }, 500);
    }

    const data = await res.json() as FinnhubCalendarResponse;
    const earnings = Array.isArray(data.earningsCalendar) ? data.earningsCalendar : [];

    const result = processEarningsData(earnings, activeSymbols, tickerMetadata);
    const sortedResult = result.sort((a, b) => a.symbol.localeCompare(b.symbol));

    return c.json({
      earnings: sortedResult,
      date: todayStr,
      totalFound: sortedResult.length,
    });
  } catch (error) {
    logger.error("Error fetching today's earnings:", error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/earnings-tomorrow
app.get('/tomorrow', async (c) => {
  try {
    if (!c.env!.FINNHUB_API_KEY) {
      logger.error('FINNHUB_API_KEY environment variable is not set');
      return c.json({ error: 'API configuration error' }, 500);
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0]!;

    logger.debug('/api/earnings-tomorrow date:', tomorrowStr);

    // Get ticker data (from D1 or JSON based on feature flag)
    const db = createDB(c.env!);
    const [activeSymbols, tickerMetadata] = await Promise.all([
      getActiveTickerSymbols(db, c.env!),
      getTickerMetadata(db, c.env!),
    ]);

    const url = `${FINNHUB_BASE_URL}/calendar/earnings?from=${tomorrowStr}&to=${tomorrowStr}&token=${c.env!.FINNHUB_API_KEY}`;

    const res = await fetch(url);
    if (!res.ok) {
      logger.error('Finnhub fetch failed:', res.status, res.statusText);
      return c.json({ error: 'Failed to fetch from Finnhub' }, 500);
    }

    const data = await res.json() as FinnhubCalendarResponse;
    const earnings = Array.isArray(data.earningsCalendar) ? data.earningsCalendar : [];

    const result = processEarningsData(earnings, activeSymbols, tickerMetadata);
    const sortedResult = result.sort((a, b) => a.symbol.localeCompare(b.symbol));

    return c.json({
      earnings: sortedResult,
      date: tomorrowStr,
      totalFound: sortedResult.length,
    });
  } catch (error) {
    logger.error("Error fetching tomorrow's earnings:", error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/earnings-next-30-days
app.get('/next-30-days', async (c) => {
  try {
    if (!c.env!.FINNHUB_API_KEY) {
      logger.error('FINNHUB_API_KEY environment variable is not set');
      return c.json({ error: 'API configuration error' }, 500);
    }

    const today = new Date();
    const fromDate = today.toISOString().split('T')[0]!;

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    const toDate = thirtyDaysFromNow.toISOString().split('T')[0]!;

    logger.debug('/api/earnings-next-30-days date range:', { fromDate, toDate });

    // Get ticker data (from D1 or JSON based on feature flag)
    const db = createDB(c.env!);
    const [activeSymbols, tickerMetadata] = await Promise.all([
      getActiveTickerSymbols(db, c.env!),
      getTickerMetadata(db, c.env!),
    ]);

    // Split query by month to avoid cross-month issues
    const allEarnings: FinnhubEarningsCalendarItem[] = [];

    const startYear = parseInt(fromDate.substring(0, 4));
    const startMonth = parseInt(fromDate.substring(5, 7));
    const endYear = parseInt(toDate.substring(0, 4));
    const endMonth = parseInt(toDate.substring(5, 7));

    for (let year = startYear; year <= endYear; year++) {
      const firstMonth = year === startYear ? startMonth : 1;
      const lastMonth = year === endYear ? endMonth : 12;

      for (let month = firstMonth; month <= lastMonth; month++) {
        const monthStartStr = `${year}-${month.toString().padStart(2, '0')}-01`;

        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        const lastDay = new Date(nextYear, nextMonth - 1, 0).getDate();
        const monthEndStr = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

        const queryStart = monthStartStr < fromDate ? fromDate : monthStartStr;
        const queryEnd = monthEndStr > toDate ? toDate : monthEndStr;

        if (queryStart > queryEnd) continue;

        const url = `${FINNHUB_BASE_URL}/calendar/earnings?from=${queryStart}&to=${queryEnd}&token=${c.env!.FINNHUB_API_KEY}`;

        const res = await fetch(url);
        if (!res.ok) {
          logger.error('Finnhub fetch failed for month:', year, month, res.status);
          continue;
        }

        const data = await res.json() as FinnhubCalendarResponse;
        const monthEarnings = Array.isArray(data.earningsCalendar) ? data.earningsCalendar : [];
        allEarnings.push(...monthEarnings);
      }
    }

    const earnings = allEarnings
      .filter((e) => {
        const earningDate = e.date;
        return earningDate >= fromDate && earningDate <= toDate;
      })
      .filter((e, index, self) => {
        return index === self.findIndex((other) => other.symbol === e.symbol && other.date === e.date);
      });

    const result = processEarningsData(earnings, activeSymbols, tickerMetadata);
    const sortedResult = result.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateA - dateB;
    });

    return c.json({
      earnings: sortedResult,
      totalFound: sortedResult.length,
    });
  } catch (error) {
    logger.error('Error fetching next 30 days earnings:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/earnings-previous-30-days
app.get('/previous-30-days', async (c) => {
  try {
    if (!c.env!.FINNHUB_API_KEY) {
      logger.error('FINNHUB_API_KEY environment variable is not set');
      return c.json({ error: 'API configuration error' }, 500);
    }

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const fromDate = thirtyDaysAgo.toISOString().split('T')[0]!;
    const toDate = yesterday.toISOString().split('T')[0]!;

    logger.debug('/api/earnings-previous-30-days date range:', { fromDate, toDate });

    // Get ticker data (from D1 or JSON based on feature flag)
    const db = createDB(c.env!);
    const [activeSymbols, tickerMetadata] = await Promise.all([
      getActiveTickerSymbols(db, c.env!),
      getTickerMetadata(db, c.env!),
    ]);

    // Split query by month
    const allEarnings: FinnhubEarningsCalendarItem[] = [];

    const startYear = parseInt(fromDate.substring(0, 4));
    const startMonth = parseInt(fromDate.substring(5, 7));
    const endYear = parseInt(toDate.substring(0, 4));
    const endMonth = parseInt(toDate.substring(5, 7));

    for (let year = startYear; year <= endYear; year++) {
      const firstMonth = year === startYear ? startMonth : 1;
      const lastMonth = year === endYear ? endMonth : 12;

      for (let month = firstMonth; month <= lastMonth; month++) {
        const monthStartStr = `${year}-${month.toString().padStart(2, '0')}-01`;

        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        const lastDay = new Date(nextYear, nextMonth - 1, 0).getDate();
        const monthEndStr = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

        const queryStart = monthStartStr < fromDate ? fromDate : monthStartStr;
        const queryEnd = monthEndStr > toDate ? toDate : monthEndStr;

        if (queryStart > queryEnd) continue;

        const url = `${FINNHUB_BASE_URL}/calendar/earnings?from=${queryStart}&to=${queryEnd}&token=${c.env!.FINNHUB_API_KEY}`;

        const res = await fetch(url);
        if (!res.ok) {
          logger.error('Finnhub fetch failed for month:', year, month, res.status);
          continue;
        }

        const data = await res.json() as FinnhubCalendarResponse;
        const monthEarnings = Array.isArray(data.earningsCalendar) ? data.earningsCalendar : [];
        allEarnings.push(...monthEarnings);
      }
    }

    const earnings = allEarnings
      .filter((e) => {
        const earningDate = e.date;
        return earningDate >= fromDate && earningDate <= toDate;
      })
      .filter((e, index, self) => {
        return index === self.findIndex((other) => other.symbol === e.symbol && other.date === e.date);
      });

    const result = processEarningsData(earnings, activeSymbols, tickerMetadata);
    const sortedResult = result.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });

    return c.json({
      earnings: sortedResult,
      totalFound: sortedResult.length,
    });
  } catch (error) {
    logger.error('Error fetching previous 30 days earnings:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Watchlist earning item type
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

// GET /api/earnings-watchlist
app.get('/watchlist', async (c) => {
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

