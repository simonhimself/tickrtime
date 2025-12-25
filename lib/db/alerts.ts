import { createDB } from '../db';
import type { KVAlert } from '../auth';
import { logger } from '../logger';

export interface AlertRow {
  id: string;
  user_id: string;
  symbol: string;
  alert_type: 'before' | 'after';
  days_before: number | null;
  days_after: number | null;
  recurring: number; // SQLite uses INTEGER for booleans (0/1)
  earnings_date: string;
  scheduled_email_id: string | null;
  status: 'active' | 'sent' | 'cancelled';
  created_at: string;
  updated_at: string;
}

// Convert database row to KVAlert format
function rowToKVAlert(row: AlertRow): KVAlert {
  return {
    id: row.id,
    userId: row.user_id,
    symbol: row.symbol,
    alertType: row.alert_type,
    daysBefore: row.days_before ?? undefined,
    daysAfter: row.days_after ?? undefined,
    recurring: row.recurring === 1,
    earningsDate: row.earnings_date,
    scheduledEmailId: row.scheduled_email_id ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Get alert by ID
export async function getAlertById(alertId: string): Promise<KVAlert | null> {
  try {
    const db = createDB();
    const result = await db
      .prepare('SELECT * FROM alerts WHERE id = ?')
      .bind(alertId)
      .first<AlertRow>();

    if (!result) {
      return null;
    }

    return rowToKVAlert(result);
  } catch (error) {
    logger.error('Error getting alert by ID:', error);
    return null;
  }
}

// Get all alerts for a user
export async function getUserAlerts(userId: string): Promise<KVAlert[]> {
  try {
    const db = createDB();
    const result = await db
      .prepare('SELECT * FROM alerts WHERE user_id = ? ORDER BY created_at DESC')
      .bind(userId)
      .all<AlertRow>();

    if (!result.success || !result.results) {
      return [];
    }

    return result.results.map(rowToKVAlert);
  } catch (error) {
    logger.error('Error getting user alerts:', error);
    return [];
  }
}

// Get alerts by symbol (for cron job)
export async function getAlertsBySymbol(symbol: string): Promise<KVAlert[]> {
  try {
    const db = createDB();
    const result = await db
      .prepare('SELECT * FROM alerts WHERE symbol = ? AND status = ?')
      .bind(symbol, 'active')
      .all<AlertRow>();

    if (!result.success || !result.results) {
      return [];
    }

    return result.results.map(rowToKVAlert);
  } catch (error) {
    logger.error('Error getting alerts by symbol:', error);
    return [];
  }
}

// Get active "after" alerts that need to be processed (for cron job)
export async function getActiveAfterAlerts(earningsDate?: string): Promise<KVAlert[]> {
  try {
    const db = createDB();
    let query = `SELECT * FROM alerts 
                 WHERE status = ? AND alert_type = ? AND earnings_date <= ? 
                 ORDER BY earnings_date ASC`;
    
    const dateToCheck = earningsDate || new Date().toISOString().split('T')[0];
    
    const result = await db
      .prepare(query)
      .bind('active', 'after', dateToCheck)
      .all<AlertRow>();

    if (!result.success || !result.results) {
      return [];
    }

    return result.results.map(rowToKVAlert);
  } catch (error) {
    logger.error('Error getting active after alerts:', error);
    return [];
  }
}

// Create new alert
export async function createAlert(alert: {
  id: string;
  userId: string;
  symbol: string;
  alertType: 'before' | 'after';
  daysBefore?: number;
  daysAfter?: number;
  recurring: boolean;
  earningsDate: string;
  scheduledEmailId?: string;
  status?: 'active' | 'sent' | 'cancelled';
}): Promise<boolean> {
  try {
    const db = createDB();
    const now = new Date().toISOString();

    const result = await db
      .prepare(
        `INSERT INTO alerts (id, user_id, symbol, alert_type, days_before, days_after, recurring, earnings_date, scheduled_email_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        alert.id,
        alert.userId,
        alert.symbol,
        alert.alertType,
        alert.daysBefore ?? null,
        alert.daysAfter ?? null,
        alert.recurring ? 1 : 0,
        alert.earningsDate,
        alert.scheduledEmailId ?? null,
        alert.status || 'active',
        now,
        now
      )
      .run();

    return result.success && result.meta.changes > 0;
  } catch (error) {
    logger.error('Error creating alert:', error);
    return false;
  }
}

// Update alert
export async function updateAlert(
  alertId: string,
  updates: Partial<{
    symbol: string;
    alertType: 'before' | 'after';
    daysBefore: number;
    daysAfter: number;
    recurring: boolean;
    earningsDate: string;
    scheduledEmailId: string;
    status: 'active' | 'sent' | 'cancelled';
  }>
): Promise<boolean> {
  try {
    const db = createDB();
    const now = new Date().toISOString();
    
    // Build dynamic update query
    const fields: string[] = ['updated_at = ?'];
    const values: unknown[] = [now];

    if (updates.symbol !== undefined) {
      fields.push('symbol = ?');
      values.push(updates.symbol);
    }
    if (updates.alertType !== undefined) {
      fields.push('alert_type = ?');
      values.push(updates.alertType);
    }
    if (updates.daysBefore !== undefined) {
      fields.push('days_before = ?');
      values.push(updates.daysBefore);
    }
    if (updates.daysAfter !== undefined) {
      fields.push('days_after = ?');
      values.push(updates.daysAfter);
    }
    if (updates.recurring !== undefined) {
      fields.push('recurring = ?');
      values.push(updates.recurring ? 1 : 0);
    }
    if (updates.earningsDate !== undefined) {
      fields.push('earnings_date = ?');
      values.push(updates.earningsDate);
    }
    if (updates.scheduledEmailId !== undefined) {
      fields.push('scheduled_email_id = ?');
      values.push(updates.scheduledEmailId);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }

    values.push(alertId); // For WHERE clause

    const query = `UPDATE alerts SET ${fields.join(', ')} WHERE id = ?`;
    const result = await db.prepare(query).bind(...values).run();

    return result.success && result.meta.changes > 0;
  } catch (error) {
    logger.error('Error updating alert:', error);
    return false;
  }
}

// Delete alert
export async function deleteAlert(alertId: string): Promise<boolean> {
  try {
    const db = createDB();
    const result = await db
      .prepare('DELETE FROM alerts WHERE id = ?')
      .bind(alertId)
      .run();

    return result.success && result.meta.changes > 0;
  } catch (error) {
    logger.error('Error deleting alert:', error);
    return false;
  }
}

// Get alert by user ID and alert ID (for authorization checks)
export async function getAlertByUserAndId(userId: string, alertId: string): Promise<KVAlert | null> {
  try {
    const db = createDB();
    const result = await db
      .prepare('SELECT * FROM alerts WHERE id = ? AND user_id = ?')
      .bind(alertId, userId)
      .first<AlertRow>();

    if (!result) {
      return null;
    }

    return rowToKVAlert(result);
  } catch (error) {
    logger.error('Error getting alert by user and ID:', error);
    return null;
  }
}


