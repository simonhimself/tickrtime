import { Hono } from 'hono';
import type { Env } from '../index';
import { createLogger } from '../lib/logger';
import techTickers from '../../data/tech_tickers.json';

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

interface TechTickerItem {
  symbol: string;
  description?: string;
  exchange?: string;
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
}

const app = new Hono<{ Bindings: Env }>();
const logger = createLogger('earnings-previous-30-days');

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

function processEarningsData(earnings: FinnhubEarningsCalendarItem[], tickers: TechTickerItem[]): ProcessedEarning[] {
  const techSymbols = new Set(tickers.map((t) => t.symbol));

  return earnings
    .filter((e) => techSymbols.has(e.symbol))
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

      const techTicker = tickers.find((t) => t.symbol === e.symbol);

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
        exchange: techTicker?.exchange || undefined,
        description: techTicker?.description || undefined,
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
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const fromDate = thirtyDaysAgo.toISOString().split('T')[0]!;
    const toDate = yesterday.toISOString().split('T')[0]!;

    logger.debug('/api/earnings-previous-30-days date range:', { fromDate, toDate });

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

    const result = processEarningsData(earnings, techTickers as TechTickerItem[]);
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

export default app;

