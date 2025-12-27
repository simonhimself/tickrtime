import { Hono } from 'hono';
import type { Env } from '../index';
import { createLogger } from '../lib/logger';
import { createDB } from '../lib/db';
import { getUserById } from '../lib/db/users';
import { getActiveAfterAlerts, updateAlert } from '../lib/db/alerts';
import {
  getActiveSymbols,
  upsertTicker,
  markTickerInactive,
  getUnenrichedTickers,
  updateTickerProfile,
  mapIndustryToSector,
} from '../lib/db/tickers';
import { sendEarningsAlertEmail } from '../lib/email';

const app = new Hono<{ Bindings: Env }>();
const logger = createLogger('cron');

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

// Exchange configuration for ticker sync
const EXCHANGES = [
  { mic: 'XNAS', exchange: 'NASDAQ' },
  { mic: 'XNYS', exchange: 'NYSE' },
];

// Rate limiting for enrichment (stay well under 60/min free tier limit)
const ENRICHMENT_BATCH_SIZE = 50;
const ENRICHMENT_DELAY_MS = 1100; // ~54 calls/min max

// Helper to fetch earnings data for a symbol
async function getEarningsData(symbol: string, date: string, finnhubApiKey: string | undefined): Promise<{
  actual: number | null;
  estimate: number | null;
  surprise: number | null;
  surprisePercent: number | null;
}> {
  try {
    if (!finnhubApiKey) {
      return { actual: null, estimate: null, surprise: null, surprisePercent: null };
    }

    const url = `${FINNHUB_BASE_URL}/stock/earnings?symbol=${symbol.toUpperCase()}&token=${finnhubApiKey}`;
    const res = await fetch(url);

    if (!res.ok) {
      return { actual: null, estimate: null, surprise: null, surprisePercent: null };
    }

    const data = await res.json();
    const earnings = Array.isArray(data) ? data : [];

    // Find earnings matching the date (quarter/year)
    const targetDate = new Date(date);
    const targetYear = targetDate.getFullYear();
    const targetQuarter = Math.floor(targetDate.getMonth() / 3) + 1;

    const matchingEarning = earnings.find((e: any) => 
      e.year === targetYear && e.quarter === targetQuarter
    );

    if (matchingEarning) {
      return {
        actual: typeof matchingEarning.actual === 'number' ? matchingEarning.actual : (matchingEarning.actual ? parseFloat(matchingEarning.actual) : null),
        estimate: typeof matchingEarning.estimate === 'number' ? matchingEarning.estimate : (matchingEarning.estimate ? parseFloat(matchingEarning.estimate) : null),
        surprise: typeof matchingEarning.surprise === 'number' ? matchingEarning.surprise : (matchingEarning.surprise ? parseFloat(matchingEarning.surprise) : null),
        surprisePercent: typeof matchingEarning.surprisePercent === 'number' ? matchingEarning.surprisePercent : (matchingEarning.surprisePercent ? parseFloat(matchingEarning.surprisePercent) : null),
      };
    }

    return { actual: null, estimate: null, surprise: null, surprisePercent: null };
  } catch (error) {
    logger.error(`Error fetching earnings data for ${symbol}:`, error);
    return { actual: null, estimate: null, surprise: null, surprisePercent: null };
  }
}

// POST /api/cron/check-alerts - Check and process "after" alerts (called by cron job)
app.post('/check-alerts', async (c) => {
  try {
    // Optional: Add authentication for cron endpoint
    const cronSecret = c.req.header('x-cron-secret');
    const expectedSecret = c.env!.CRON_SECRET;

    if (expectedSecret && cronSecret !== expectedSecret) {
      return c.json({ success: false, message: 'Unauthorized' }, 401);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0]!;

    const db = createDB(c.env!);
    
    // Get all active "after" alerts that need to be processed
    const alerts = await getActiveAfterAlerts(db, todayStr);

    let processedCount = 0;
    let sentCount = 0;

    // Process each alert
    for (const alert of alerts) {
      processedCount++;
      
      const earningsDate = new Date(alert.earningsDate);
      earningsDate.setHours(0, 0, 0, 0);
      
      const alertDate = new Date(earningsDate);
      alertDate.setDate(alertDate.getDate() + (alert.daysAfter || 0));
      
      // Check if alert date has passed
      if (alertDate <= today) {
        const kvUser = await getUserById(db, alert.userId);
        if (!kvUser || !kvUser.notificationPreferences?.emailEnabled) {
          continue;
        }

        // Fetch earnings data
        const earningsData = await getEarningsData(alert.symbol, alert.earningsDate, c.env!.FINNHUB_API_KEY);

        // Send email
        const emailResult = await sendEarningsAlertEmail({
          email: kvUser.email,
          symbol: alert.symbol,
          earningsDate: alert.earningsDate,
          daysAfter: alert.daysAfter,
          alertType: 'after',
          userName: kvUser.email.split('@')[0],
          ...earningsData,
        }, c.env!.RESEND_API_KEY, c.env!.NEXT_PUBLIC_APP_URL);

        if (emailResult.success) {
          sentCount++;
          
          // Update alert: if recurring, keep active; otherwise mark as sent
          if (alert.recurring) {
            await updateAlert(db, alert.id, {
              status: 'active',
            });
          } else {
            await updateAlert(db, alert.id, {
              status: 'sent',
            });
          }
        }
      }
    }

    return c.json({
      success: true,
      message: `Processed ${processedCount} alerts, sent ${sentCount} emails`,
      processed: processedCount,
      sent: sentCount,
    });
  } catch (error) {
    logger.error('Cron check alerts error:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
});

// Finnhub API types for ticker sync
interface FinnhubSymbol {
  symbol: string;
  description: string;
  type?: string;
  displaySymbol?: string;
}

interface FinnhubProfile {
  finnhubIndustry?: string;
  name?: string;
  country?: string;
  exchange?: string;
}

// Helper to fetch symbols from an exchange
async function fetchExchangeSymbols(
  mic: string,
  finnhubApiKey: string
): Promise<FinnhubSymbol[]> {
  const url = `${FINNHUB_BASE_URL}/stock/symbol?exchange=US&mic=${mic}&token=${finnhubApiKey}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to fetch symbols for ${mic}: ${res.status}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// Helper to fetch profile for a symbol
async function fetchSymbolProfile(
  symbol: string,
  finnhubApiKey: string
): Promise<FinnhubProfile | null> {
  try {
    const url = `${FINNHUB_BASE_URL}/stock/profile2?symbol=${symbol}&token=${finnhubApiKey}`;
    const res = await fetch(url);

    if (!res.ok) {
      return null;
    }

    return (await res.json()) as FinnhubProfile;
  } catch {
    return null;
  }
}

// Helper for delay
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// POST /api/cron/sync-tickers - Sync ticker universe (daily cron job)
app.post('/sync-tickers', async (c) => {
  try {
    // Authenticate cron request
    const cronSecret = c.req.header('x-cron-secret');
    const expectedSecret = c.env!.CRON_SECRET;

    if (expectedSecret && cronSecret !== expectedSecret) {
      return c.json({ success: false, message: 'Unauthorized' }, 401);
    }

    if (!c.env!.FINNHUB_API_KEY) {
      return c.json({ success: false, message: 'FINNHUB_API_KEY not configured' }, 500);
    }

    const db = createDB(c.env!);
    const startTime = Date.now();

    // Step 1: Fetch all current symbols from exchanges
    logger.info('Fetching current exchange symbols...');
    const currentSymbolsMap = new Map<string, { symbol: string; description: string; exchange: string }>();

    for (const { mic, exchange } of EXCHANGES) {
      try {
        const symbols = await fetchExchangeSymbols(mic, c.env!.FINNHUB_API_KEY);
        for (const s of symbols) {
          currentSymbolsMap.set(s.symbol, {
            symbol: s.symbol,
            description: s.description || s.displaySymbol || s.symbol,
            exchange,
          });
        }
        logger.info(`Fetched ${symbols.length} symbols from ${exchange}`);
      } catch (error) {
        logger.error(`Failed to fetch ${exchange} symbols:`, error);
      }
    }

    // Step 2: Get stored symbols from database
    const storedSymbols = await getActiveSymbols(db);
    logger.info(`Found ${storedSymbols.size} stored active symbols`);

    // Step 3: Identify new and delisted symbols
    const currentSymbolSet = new Set(currentSymbolsMap.keys());
    const newSymbols: string[] = [];
    const delistedSymbols: string[] = [];

    // New symbols: in current but not in stored
    for (const symbol of currentSymbolSet) {
      if (!storedSymbols.has(symbol)) {
        newSymbols.push(symbol);
      }
    }

    // Delisted symbols: in stored but not in current
    for (const symbol of storedSymbols) {
      if (!currentSymbolSet.has(symbol)) {
        delistedSymbols.push(symbol);
      }
    }

    logger.info(`Found ${newSymbols.length} new symbols, ${delistedSymbols.length} delisted`);

    // Step 4: Insert new symbols
    let insertedCount = 0;
    for (const symbol of newSymbols) {
      const symbolData = currentSymbolsMap.get(symbol);
      if (symbolData) {
        const success = await upsertTicker(db, {
          symbol: symbolData.symbol,
          description: symbolData.description,
          exchange: symbolData.exchange,
          isActive: true,
        });
        if (success) insertedCount++;
      }
    }

    // Step 5: Mark delisted symbols as inactive
    let delistedCount = 0;
    for (const symbol of delistedSymbols) {
      const success = await markTickerInactive(db, symbol);
      if (success) delistedCount++;
    }

    // Step 6: Enrich a batch of unenriched symbols
    const unenrichedTickers = await getUnenrichedTickers(db, ENRICHMENT_BATCH_SIZE);
    let enrichedCount = 0;

    for (const ticker of unenrichedTickers) {
      const profile = await fetchSymbolProfile(ticker.symbol, c.env!.FINNHUB_API_KEY);

      if (profile) {
        const industry = profile.finnhubIndustry || null;
        const sector = mapIndustryToSector(industry);

        await updateTickerProfile(db, ticker.symbol, {
          industry: industry ?? undefined,
          sector: sector ?? undefined,
        });
        enrichedCount++;
      }

      // Small delay to respect rate limits
      await delay(ENRICHMENT_DELAY_MS);
    }

    const duration = Date.now() - startTime;

    logger.info(`Ticker sync complete in ${duration}ms`);
    logger.info(`Inserted: ${insertedCount}, Delisted: ${delistedCount}, Enriched: ${enrichedCount}`);

    return c.json({
      success: true,
      message: 'Ticker sync complete',
      stats: {
        currentSymbols: currentSymbolsMap.size,
        storedSymbols: storedSymbols.size,
        newSymbols: newSymbols.length,
        inserted: insertedCount,
        delistedSymbols: delistedSymbols.length,
        delistedMarked: delistedCount,
        unenrichedFound: unenrichedTickers.length,
        enriched: enrichedCount,
        durationMs: duration,
      },
    });
  } catch (error) {
    logger.error('Cron sync tickers error:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
});

export default app;





