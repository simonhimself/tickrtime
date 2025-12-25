import { Hono } from 'hono';
import type { Env } from '../index';
import { createLogger } from '../lib/logger';
import { createDB } from '../lib/db';
import { getUserById } from '../lib/db/users';
import { getActiveAfterAlerts, updateAlert } from '../lib/db/alerts';
import { sendEarningsAlertEmail } from '../lib/email';

const app = new Hono<{ Bindings: Env }>();
const logger = createLogger('cron');

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

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
    const expectedSecret = c.env.CRON_SECRET;
    
    if (expectedSecret && cronSecret !== expectedSecret) {
      return c.json({ success: false, message: 'Unauthorized' }, 401);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0]!;

    const db = createDB(c.env);
    
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
        const earningsData = await getEarningsData(alert.symbol, alert.earningsDate, c.env.FINNHUB_API_KEY);

        // Send email
        const emailResult = await sendEarningsAlertEmail({
          email: kvUser.email,
          symbol: alert.symbol,
          earningsDate: alert.earningsDate,
          daysAfter: alert.daysAfter,
          alertType: 'after',
          userName: kvUser.email.split('@')[0],
          ...earningsData,
        }, c.env.RESEND_API_KEY, c.env.NEXT_PUBLIC_APP_URL);

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

export default app;

