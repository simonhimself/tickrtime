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
const logger = createLogger('earnings-next-30-days');

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

export default app;
