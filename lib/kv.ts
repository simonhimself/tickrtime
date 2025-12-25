import type { KVUser, KVWatchlist, KVAlert } from './auth';
import { generateUUID } from './crypto-edge';

// Cloudflare KV namespace type
interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  put(entries: { key: string; value: string; expirationTtl?: number }[]): Promise<void>;
  delete(key: string): Promise<void>;
  delete(keys: string[]): Promise<void>;
}

// KV key prefixes for organization
export const KV_KEYS = {
  USER: 'user:',
  WATCHLIST: 'watchlist:',
  VERIFICATION: 'verify:',
  EMAIL_TO_USER: 'email:',
  ALERT: 'alert:',
  ALERTS: 'alerts:',
  ALERTS_BY_SYMBOL: 'alerts:symbol:',
} as const;

// Get user by ID
export async function getUserById(kv: KVNamespace, userId: string): Promise<KVUser | null> {
  try {
    const userData = await kv.get(KV_KEYS.USER + userId);
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Error getting user by ID:', error);
    return null;
  }
}

// Get user by email
export async function getUserByEmail(kv: KVNamespace, email: string): Promise<KVUser | null> {
  try {
    const userId = await kv.get(KV_KEYS.EMAIL_TO_USER + email.toLowerCase());
    if (!userId) return null;
    
    return await getUserById(kv, userId);
  } catch (error) {
    console.error('Error getting user by email:', error);
    return null;
  }
}

// Save user
export async function saveUser(kv: KVNamespace, user: KVUser): Promise<boolean> {
  try {
    const batch = [
      { key: KV_KEYS.USER + user.id, value: JSON.stringify(user) },
      { key: KV_KEYS.EMAIL_TO_USER + user.email, value: user.id }
    ];
    
    await kv.put(batch);
    return true;
  } catch (error) {
    console.error('Error saving user:', error);
    return false;
  }
}

// Update user
export async function updateUser(kv: KVNamespace, user: KVUser): Promise<boolean> {
  try {
    user.updatedAt = new Date().toISOString();
    await kv.put(KV_KEYS.USER + user.id, JSON.stringify(user));
    return true;
  } catch (error) {
    console.error('Error updating user:', error);
    return false;
  }
}

// Delete user
export async function deleteUser(kv: KVNamespace, user: KVUser): Promise<boolean> {
  try {
    // Delete all user alerts
    const alerts = await getUserAlerts(kv, user.id);
    for (const alert of alerts) {
      await deleteAlert(kv, user.id, alert.id);
    }
    
    const batch = [
      { key: KV_KEYS.USER + user.id, value: '' },
      { key: KV_KEYS.EMAIL_TO_USER + user.email, value: '' },
      { key: KV_KEYS.WATCHLIST + user.id, value: '' },
      { key: KV_KEYS.ALERTS + user.id, value: '' }
    ];
    
    await kv.delete(batch.map(item => item.key));
    return true;
  } catch (error) {
    console.error('Error deleting user:', error);
    return false;
  }
}

// Get user's watchlist
export async function getWatchlist(kv: KVNamespace, userId: string): Promise<KVWatchlist> {
  try {
    const watchlistData = await kv.get(KV_KEYS.WATCHLIST + userId);
    if (watchlistData) {
      return JSON.parse(watchlistData);
    }
    
    // Return empty watchlist if none exists
    return {
      tickers: [],
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error getting watchlist:', error);
    return {
      tickers: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}

// Save watchlist
export async function saveWatchlist(kv: KVNamespace, userId: string, watchlist: KVWatchlist): Promise<boolean> {
  try {
    watchlist.lastUpdated = new Date().toISOString();
    await kv.put(KV_KEYS.WATCHLIST + userId, JSON.stringify(watchlist));
    return true;
  } catch (error) {
    console.error('Error saving watchlist:', error);
    return false;
  }
}

// Add ticker to watchlist
export async function addTickerToWatchlist(kv: KVNamespace, userId: string, symbol: string): Promise<boolean> {
  try {
    const watchlist = await getWatchlist(kv, userId);
    const normalizedSymbol = symbol.toUpperCase();
    
    if (!watchlist.tickers.includes(normalizedSymbol)) {
      watchlist.tickers.push(normalizedSymbol);
      return await saveWatchlist(kv, userId, watchlist);
    }
    
    return true; // Already exists
  } catch (error) {
    console.error('Error adding ticker to watchlist:', error);
    return false;
  }
}

// Remove ticker from watchlist
export async function removeTickerFromWatchlist(kv: KVNamespace, userId: string, symbol: string): Promise<boolean> {
  try {
    const watchlist = await getWatchlist(kv, userId);
    const normalizedSymbol = symbol.toUpperCase();
    
    watchlist.tickers = watchlist.tickers.filter(ticker => ticker !== normalizedSymbol);
    return await saveWatchlist(kv, userId, watchlist);
  } catch (error) {
    console.error('Error removing ticker from watchlist:', error);
    return false;
  }
}

// Get verification token
export async function getVerificationToken(kv: KVNamespace, token: string): Promise<string | null> {
  try {
    return await kv.get(KV_KEYS.VERIFICATION + token);
  } catch (error) {
    console.error('Error getting verification token:', error);
    return null;
  }
}

// Save verification token
export async function saveVerificationToken(kv: KVNamespace, token: string, userId: string, expiresIn: number = 3600): Promise<boolean> {
  try {
    await kv.put(KV_KEYS.VERIFICATION + token, userId, { expirationTtl: expiresIn });
    return true;
  } catch (error) {
    console.error('Error saving verification token:', error);
    return false;
  }
}

// Delete verification token
export async function deleteVerificationToken(kv: KVNamespace, token: string): Promise<boolean> {
  try {
    await kv.delete(KV_KEYS.VERIFICATION + token);
    return true;
  } catch (error) {
    console.error('Error deleting verification token:', error);
    return false;
  }
}

// Get user's alert IDs list
async function getUserAlertIds(kv: KVNamespace, userId: string): Promise<string[]> {
  try {
    const alertIdsData = await kv.get(KV_KEYS.ALERTS + userId);
    if (alertIdsData) {
      return JSON.parse(alertIdsData);
    }
    return [];
  } catch (error) {
    console.error('Error getting user alert IDs:', error);
    return [];
  }
}

// Save user's alert IDs list
async function saveUserAlertIds(kv: KVNamespace, userId: string, alertIds: string[]): Promise<boolean> {
  try {
    await kv.put(KV_KEYS.ALERTS + userId, JSON.stringify(alertIds));
    return true;
  } catch (error) {
    console.error('Error saving user alert IDs:', error);
    return false;
  }
}

// Save alert
export async function saveAlert(kv: KVNamespace, userId: string, alert: KVAlert): Promise<boolean> {
  try {
    const alertKey = `${KV_KEYS.ALERT}${userId}:${alert.id}`;
    const symbolIndexKey = `${KV_KEYS.ALERTS_BY_SYMBOL}${alert.symbol.toUpperCase()}`;
    
    // Save the alert
    await kv.put(alertKey, JSON.stringify(alert));
    
    // Update user's alert IDs list
    const alertIds = await getUserAlertIds(kv, userId);
    if (!alertIds.includes(alert.id)) {
      alertIds.push(alert.id);
      await saveUserAlertIds(kv, userId, alertIds);
    }
    
    // Update symbol index (for cron job lookup)
    const symbolAlertsData = await kv.get(symbolIndexKey);
    const symbolAlerts = symbolAlertsData ? JSON.parse(symbolAlertsData) : [];
    if (!symbolAlerts.includes(alert.id)) {
      symbolAlerts.push(alert.id);
      await kv.put(symbolIndexKey, JSON.stringify(symbolAlerts));
    }
    
    return true;
  } catch (error) {
    console.error('Error saving alert:', error);
    return false;
  }
}

// Get alert
export async function getAlert(kv: KVNamespace, userId: string, alertId: string): Promise<KVAlert | null> {
  try {
    const alertKey = `${KV_KEYS.ALERT}${userId}:${alertId}`;
    const alertData = await kv.get(alertKey);
    return alertData ? JSON.parse(alertData) : null;
  } catch (error) {
    console.error('Error getting alert:', error);
    return null;
  }
}

// Get all alerts for a user
export async function getUserAlerts(kv: KVNamespace, userId: string): Promise<KVAlert[]> {
  try {
    const alertIds = await getUserAlertIds(kv, userId);
    const alerts: KVAlert[] = [];
    
    for (const alertId of alertIds) {
      const alert = await getAlert(kv, userId, alertId);
      if (alert) {
        alerts.push(alert);
      }
    }
    
    return alerts;
  } catch (error) {
    console.error('Error getting user alerts:', error);
    return [];
  }
}

// Update alert
export async function updateAlert(kv: KVNamespace, userId: string, alertId: string, updates: Partial<KVAlert>): Promise<boolean> {
  try {
    const alert = await getAlert(kv, userId, alertId);
    if (!alert) {
      return false;
    }
    
    const updatedAlert: KVAlert = {
      ...alert,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    return await saveAlert(kv, userId, updatedAlert);
  } catch (error) {
    console.error('Error updating alert:', error);
    return false;
  }
}

// Delete alert
export async function deleteAlert(kv: KVNamespace, userId: string, alertId: string): Promise<boolean> {
  try {
    const alert = await getAlert(kv, userId, alertId);
    if (!alert) {
      return false;
    }
    
    const alertKey = `${KV_KEYS.ALERT}${userId}:${alertId}`;
    const symbolIndexKey = `${KV_KEYS.ALERTS_BY_SYMBOL}${alert.symbol.toUpperCase()}`;
    
    // Delete the alert
    await kv.delete(alertKey);
    
    // Update user's alert IDs list
    const alertIds = await getUserAlertIds(kv, userId);
    const updatedAlertIds = alertIds.filter(id => id !== alertId);
    await saveUserAlertIds(kv, userId, updatedAlertIds);
    
    // Update symbol index
    const symbolAlertsData = await kv.get(symbolIndexKey);
    if (symbolAlertsData) {
      const symbolAlerts = JSON.parse(symbolAlertsData);
      const updatedSymbolAlerts = symbolAlerts.filter((id: string) => id !== alertId);
      if (updatedSymbolAlerts.length > 0) {
        await kv.put(symbolIndexKey, JSON.stringify(updatedSymbolAlerts));
      } else {
        await kv.delete(symbolIndexKey);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error deleting alert:', error);
    return false;
  }
}

// Get alerts by symbol (for cron job) - requires userId list
// Note: This is a helper that requires knowing which users to check
export async function getAlertsBySymbol(kv: KVNamespace, symbol: string, userIds: string[]): Promise<KVAlert[]> {
  try {
    const alerts: KVAlert[] = [];
    
    for (const userId of userIds) {
      const userAlerts = await getUserAlerts(kv, userId);
      const symbolAlerts = userAlerts.filter(
        alert => alert.symbol.toUpperCase() === symbol.toUpperCase() && alert.status === 'active'
      );
      alerts.push(...symbolAlerts);
    }
    
    return alerts;
  } catch (error) {
    console.error('Error getting alerts by symbol:', error);
    return [];
  }
}

// Helper to get all active "after" alerts for a specific user (for cron job)
export async function getActiveAfterAlerts(kv: KVNamespace, userId: string): Promise<KVAlert[]> {
  try {
    const allAlerts = await getUserAlerts(kv, userId);
    return allAlerts.filter(
      alert => alert.status === 'active' && alert.alertType === 'after'
    );
  } catch (error) {
    console.error('Error getting active after alerts:', error);
    return [];
  }
}
