import { Hono } from 'hono';
import type { Env } from '../index';
import { createLogger } from '../lib/logger';
import techTickers from '../../data/tech_tickers.json';

const app = new Hono<{ Bindings: Env }>();
const logger = createLogger('earnings-tomorrow');

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

function processEarningsData(earnings: any[], techTickers: any[]) {
  const techSymbols = new Set(techTickers.map((t: any) => t.symbol));
  
  return earnings
    .filter((e: any) => techSymbols.has(e.symbol))
    .map((e: any) => {
      const actual = typeof e.epsActual === 'number' 
        ? e.epsActual 
        : (e.epsActual ? parseFloat(e.epsActual) : null);
      const estimate = typeof e.epsEstimate === 'number' 
        ? e.epsEstimate 
        : (e.epsEstimate ? parseFloat(e.epsEstimate) : null);
      
      let surprise = null;
      let surprisePercent = null;
      
      if (actual !== null && estimate !== null && !isNaN(actual) && !isNaN(estimate)) {
        surprise = actual - estimate;
        surprisePercent = estimate !== 0 ? ((actual - estimate) / Math.abs(estimate)) * 100 : null;
      }
      
      const techTicker = techTickers.find((t: any) => t.symbol === e.symbol);
      
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
    if (!c.env.FINNHUB_API_KEY) {
      logger.error('FINNHUB_API_KEY environment variable is not set');
      return c.json({ error: 'API configuration error' }, 500);
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0]!;
    
    logger.debug('/api/earnings-tomorrow date:', tomorrowStr);

    const url = `${FINNHUB_BASE_URL}/calendar/earnings?from=${tomorrowStr}&to=${tomorrowStr}&token=${c.env.FINNHUB_API_KEY}`;

    const res = await fetch(url);
    if (!res.ok) {
      logger.error('Finnhub fetch failed:', res.status, res.statusText);
      return c.json({ error: 'Failed to fetch from Finnhub' }, 500);
    }
    
    const data = await res.json();
    const earnings = Array.isArray(data.earningsCalendar) ? data.earningsCalendar : [];
    
    const result = processEarningsData(earnings, techTickers);
    const sortedResult = result.sort((a: any, b: any) => a.symbol.localeCompare(b.symbol));

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

export default app;

