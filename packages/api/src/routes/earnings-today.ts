import { Hono } from 'hono';
import type { Env } from '../index';
import { createLogger } from '../lib/logger';
import { createDB } from '../lib/db';
import { getActiveTickerSymbols, getTickerMetadata, type TickerMetadata } from '../lib/ticker-data';

// Finnhub API response types
interface FinnhubEarningsCalendarItem {
  symbol: string;
  date: string;
  hour?: string;
  quarter?: number;
  year?: number;
  epsActual?: number | string | null;
  epsEstimate?: number | string | null;
}

interface FinnhubCalendarResponse {
  earningsCalendar?: FinnhubEarningsCalendarItem[];
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
const logger = createLogger('earnings-today');

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

function processEarningsData(
  earnings: FinnhubEarningsCalendarItem[],
  activeSymbols: Set<string>,
  tickerMetadata: Map<string, TickerMetadata>
): ProcessedEarning[] {
  return earnings
    .filter((e) => activeSymbols.has(e.symbol))
    .map((e) => {
      const actual = typeof e.epsActual === 'number'
        ? e.epsActual
        : (e.epsActual ? parseFloat(String(e.epsActual)) : null);
      const estimate = typeof e.epsEstimate === 'number'
        ? e.epsEstimate
        : (e.epsEstimate ? parseFloat(String(e.epsEstimate)) : null);

      let surprise: number | null = null;
      let surprisePercent: number | null = null;

      if (actual !== null && estimate !== null && !isNaN(actual) && !isNaN(estimate)) {
        surprise = actual - estimate;
        surprisePercent = estimate !== 0 ? ((actual - estimate) / Math.abs(estimate)) * 100 : null;
      }

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

app.get('/', async (c) => {
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

export default app;

