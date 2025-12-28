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
import { generateUnsubscribeToken } from '../lib/crypto';

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

// Finnhub earnings calendar response type
interface FinnhubEarningsCalendarItem {
  symbol: string;
  date: string;
  hour?: string;
  quarter?: number;
  year?: number;
}

interface FinnhubCalendarResponse {
  earningsCalendar?: FinnhubEarningsCalendarItem[];
}

// Helper to fetch the next earnings date for a symbol (for recurring alerts)
async function getNextEarningsDate(
  symbol: string,
  afterDate: string,
  finnhubApiKey: string | undefined
): Promise<string | null> {
  try {
    if (!finnhubApiKey) {
      return null;
    }

    // Search from the day after the current earnings date to 1 year out
    const fromDate = new Date(afterDate);
    fromDate.setDate(fromDate.getDate() + 1);
    const fromDateStr = fromDate.toISOString().split('T')[0]!;

    const toDate = new Date(afterDate);
    toDate.setFullYear(toDate.getFullYear() + 1);
    const toDateStr = toDate.toISOString().split('T')[0]!;

    // Use the calendar endpoint filtered by symbol
    const url = `${FINNHUB_BASE_URL}/calendar/earnings?symbol=${symbol.toUpperCase()}&from=${fromDateStr}&to=${toDateStr}&token=${finnhubApiKey}`;
    const res = await fetch(url);

    if (!res.ok) {
      logger.warn(`Failed to fetch next earnings date for ${symbol}: ${res.status}`);
      return null;
    }

    const data = (await res.json()) as FinnhubCalendarResponse;
    const earnings = Array.isArray(data.earningsCalendar) ? data.earningsCalendar : [];

    // Find the first upcoming earnings date for this symbol
    const nextEarnings = earnings
      .filter((e) => e.symbol === symbol.toUpperCase() && e.date > afterDate)
      .sort((a, b) => a.date.localeCompare(b.date))[0];

    if (nextEarnings) {
      logger.debug(`Next earnings date for ${symbol}: ${nextEarnings.date}`);
      return nextEarnings.date;
    }

    logger.debug(`No upcoming earnings found for ${symbol} after ${afterDate}`);
    return null;
  } catch (error) {
    logger.error(`Error fetching next earnings date for ${symbol}:`, error);
    return null;
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

    let recurringUpdatedCount = 0;

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
          // If email is disabled, still update recurring alerts to next date
          if (alert.recurring) {
            const nextEarningsDate = await getNextEarningsDate(
              alert.symbol,
              alert.earningsDate,
              c.env!.FINNHUB_API_KEY
            );
            if (nextEarningsDate) {
              await updateAlert(db, alert.id, {
                earningsDate: nextEarningsDate,
                status: 'active',
              });
              recurringUpdatedCount++;
            } else {
              // No next earnings date found, mark as sent
              await updateAlert(db, alert.id, {
                status: 'sent',
              });
            }
          }
          continue;
        }

        // Fetch earnings data
        const earningsData = await getEarningsData(alert.symbol, alert.earningsDate, c.env!.FINNHUB_API_KEY);

        // Generate unsubscribe tokens
        const appUrl = c.env!.NEXT_PUBLIC_APP_URL;
        const jwtSecret = c.env!.JWT_SECRET;

        const unsubscribeAlertToken = await generateUnsubscribeToken(
          { alertId: alert.id, userId: alert.userId, type: 'alert' },
          jwtSecret
        );
        const unsubscribeAllToken = await generateUnsubscribeToken(
          { alertId: alert.id, userId: alert.userId, type: 'all' },
          jwtSecret
        );

        // Send email with unsubscribe links
        const emailResult = await sendEarningsAlertEmail({
          email: kvUser.email,
          symbol: alert.symbol,
          earningsDate: alert.earningsDate,
          daysAfter: alert.daysAfter,
          alertType: 'after',
          userName: kvUser.email.split('@')[0],
          unsubscribeAlertUrl: `${appUrl}/api/alerts/unsubscribe?token=${unsubscribeAlertToken}`,
          unsubscribeAllUrl: `${appUrl}/api/alerts/unsubscribe?token=${unsubscribeAllToken}`,
          ...earningsData,
        }, c.env!.RESEND_API_KEY, appUrl);

        if (emailResult.success) {
          sentCount++;

          // Update alert: if recurring, update to next earnings date; otherwise mark as sent
          if (alert.recurring) {
            const nextEarningsDate = await getNextEarningsDate(
              alert.symbol,
              alert.earningsDate,
              c.env!.FINNHUB_API_KEY
            );

            if (nextEarningsDate) {
              // Update alert with next earnings date and keep active
              await updateAlert(db, alert.id, {
                earningsDate: nextEarningsDate,
                status: 'active',
              });
              recurringUpdatedCount++;
              logger.info(`Recurring alert ${alert.id} for ${alert.symbol} updated to next date: ${nextEarningsDate}`);
            } else {
              // No next earnings date found, mark as sent
              await updateAlert(db, alert.id, {
                status: 'sent',
              });
              logger.info(`Recurring alert ${alert.id} for ${alert.symbol} marked as sent (no next date found)`);
            }
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
      message: `Processed ${processedCount} alerts, sent ${sentCount} emails, ${recurringUpdatedCount} recurring alerts updated`,
      processed: processedCount,
      sent: sentCount,
      recurringUpdated: recurringUpdatedCount,
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





