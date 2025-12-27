import { promises as fs } from 'fs';
import path from 'path';
import type { KVUser, KVWatchlist, KVAlert } from './auth';
import { logger } from '@/lib/logger';

// File-based storage for development persistence
const STORAGE_FILE = path.join(process.cwd(), '.dev-storage.json');

// In-memory cache for performance
let devStorageCache: Map<string, string> | null = null;

// Load data from file
async function loadStorage(): Promise<Map<string, string>> {
  if (devStorageCache) return devStorageCache;
  
  try {
    const data = await fs.readFile(STORAGE_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    devStorageCache = new Map(Object.entries(parsed));
  } catch {
    // File doesn't exist or is invalid, start with empty storage
    devStorageCache = new Map();
  }
  return devStorageCache;
}

// Save data to file
async function saveStorage(storage: Map<string, string>): Promise<void> {
  try {
    const data = Object.fromEntries(storage);
    await fs.writeFile(STORAGE_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    logger.error('Error saving dev storage:', error);
  }
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

// Development KV interface
interface DevKV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  putBatch(entries: { key: string; value: string; expirationTtl?: number }[]): Promise<void>;
  delete(key: string | string[]): Promise<void>;
}

// Create development KV instance
export function createDevKV(): DevKV {
  return {
    async get(key: string): Promise<string | null> {
      const storage = await loadStorage();
      const value = storage.get(key);
      if (!value) return null;
      
      // Check if expired (for verification tokens)
      try {
        const parsed = JSON.parse(value);
        if (parsed.expiresAt && new Date(parsed.expiresAt) < new Date()) {
          storage.delete(key);
          await saveStorage(storage);
          return null;
        }
        // Return the actual value, not the JSON string
        return parsed.value || value;
      } catch {
        return value;
      }
    },

    async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
      const storage = await loadStorage();
      if (options?.expirationTtl) {
        const expiresAt = new Date(Date.now() + options.expirationTtl * 1000);
        storage.set(key, JSON.stringify({ value, expiresAt }));
      } else {
        storage.set(key, value);
      }
      await saveStorage(storage);
    },

    async putBatch(entries: { key: string; value: string; expirationTtl?: number }[]): Promise<void> {
      const storage = await loadStorage();
      for (const entry of entries) {
        if (entry.expirationTtl) {
          const expiresAt = new Date(Date.now() + entry.expirationTtl * 1000);
          storage.set(entry.key, JSON.stringify({ value: entry.value, expiresAt }));
        } else {
          storage.set(entry.key, entry.value);
        }
      }
      await saveStorage(storage);
    },

    async delete(key: string | string[]): Promise<void> {
      const storage = await loadStorage();
      if (Array.isArray(key)) {
        for (const k of key) {
          storage.delete(k);
        }
      } else {
        storage.delete(key);
      }
      await saveStorage(storage);
    }
  };
}

// Get user by ID
export async function getUserById(kv: DevKV, userId: string): Promise<KVUser | null> {
  try {
    const userData = await kv.get(KV_KEYS.USER + userId);
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    logger.error('Error getting user by ID:', error);
    return null;
  }
}

// Get user by email
export async function getUserByEmail(kv: DevKV, email: string): Promise<KVUser | null> {
  try {
    const userId = await kv.get(KV_KEYS.EMAIL_TO_USER + email.toLowerCase());
    if (!userId) return null;
    
    return await getUserById(kv, userId);
  } catch (error) {
    logger.error('Error getting user by email:', error);
    return null;
  }
}

// Save user
export async function saveUser(kv: DevKV, user: KVUser): Promise<boolean> {
  try {
    logger.debug('saveUser called with:', user.id, user.email);
    
    // Save user data
    await kv.put(KV_KEYS.USER + user.id, JSON.stringify(user));
    logger.debug('User data saved');
    
    // Save email mapping (normalize to lowercase for consistent lookup)
    await kv.put(KV_KEYS.EMAIL_TO_USER + user.email.toLowerCase(), user.id);
    logger.debug('Email mapping saved');
    
    return true;
  } catch (error) {
    logger.error('Error saving user:', error);
    return false;
  }
}

// Update user
export async function updateUser(kv: DevKV, user: KVUser): Promise<boolean> {
  try {
    user.updatedAt = new Date().toISOString();
    await kv.put(KV_KEYS.USER + user.id, JSON.stringify(user));
    return true;
  } catch (error) {
    logger.error('Error updating user:', error);
    return false;
  }
}

// Delete user
export async function deleteUser(kv: DevKV, user: KVUser): Promise<boolean> {
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
    logger.error('Error deleting user:', error);
    return false;
  }
}

// Get user's watchlist
export async function getWatchlist(kv: DevKV, userId: string): Promise<KVWatchlist> {
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
    logger.error('Error getting watchlist:', error);
    return {
      tickers: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}

// Save watchlist
export async function saveWatchlist(kv: DevKV, userId: string, watchlist: KVWatchlist): Promise<boolean> {
  try {
    watchlist.lastUpdated = new Date().toISOString();
    await kv.put(KV_KEYS.WATCHLIST + userId, JSON.stringify(watchlist));
    return true;
  } catch (error) {
    logger.error('Error saving watchlist:', error);
    return false;
  }
}

// Add ticker to watchlist
export async function addTickerToWatchlist(kv: DevKV, userId: string, symbol: string): Promise<boolean> {
  try {
    const watchlist = await getWatchlist(kv, userId);
    const normalizedSymbol = symbol.toUpperCase();
    
    if (!watchlist.tickers.includes(normalizedSymbol)) {
      watchlist.tickers.push(normalizedSymbol);
      return await saveWatchlist(kv, userId, watchlist);
    }
    
    return true; // Already exists
  } catch (error) {
    logger.error('Error adding ticker to watchlist:', error);
    return false;
  }
}

// Remove ticker from watchlist
export async function removeTickerFromWatchlist(kv: DevKV, userId: string, symbol: string): Promise<boolean> {
  try {
    const watchlist = await getWatchlist(kv, userId);
    const normalizedSymbol = symbol.toUpperCase();
    
    watchlist.tickers = watchlist.tickers.filter(ticker => ticker !== normalizedSymbol);
    return await saveWatchlist(kv, userId, watchlist);
  } catch (error) {
    logger.error('Error removing ticker from watchlist:', error);
    return false;
  }
}

// Get verification token
export async function getVerificationToken(kv: DevKV, token: string): Promise<string | null> {
  try {
    logger.debug('Looking up verification token:', token);
    const data = await kv.get(KV_KEYS.VERIFICATION + token);
    logger.debug('Raw token data from KV:', data);
    if (!data) return null;
    
    // Try to parse as JSON first (new format)
    try {
      const parsed = JSON.parse(data);
      const userId = parsed.value || parsed.userId;
      logger.debug('Parsed token data:', { parsed, userId });
      return userId || data;
    } catch {
      // If not JSON, return as plain string (old format)
      logger.debug('Token data is plain string:', data);
      return data;
    }
  } catch (error) {
    logger.error('Error getting verification token:', error);
    return null;
  }
}

// Save verification token
export async function saveVerificationToken(kv: DevKV, token: string, userId: string, expiresIn: number = 3600): Promise<boolean> {
  try {
    logger.debug('Saving verification token:', { token, userId, expiresIn });
    // Store with expiration, which will wrap in JSON with expiresAt
    await kv.put(KV_KEYS.VERIFICATION + token, userId, { expirationTtl: expiresIn });
    logger.debug('Verification token saved successfully');
    return true;
  } catch (error) {
    logger.error('Error saving verification token:', error);
    return false;
  }
}

// Delete verification token
export async function deleteVerificationToken(kv: DevKV, token: string): Promise<boolean> {
  try {
    await kv.delete(KV_KEYS.VERIFICATION + token);
    return true;
  } catch (error) {
    logger.error('Error deleting verification token:', error);
    return false;
  }
}

// Get user's alert IDs list
async function getUserAlertIds(kv: DevKV, userId: string): Promise<string[]> {
  try {
    const alertIdsData = await kv.get(KV_KEYS.ALERTS + userId);
    if (alertIdsData) {
      return JSON.parse(alertIdsData);
    }
    return [];
  } catch (error) {
    logger.error('Error getting user alert IDs:', error);
    return [];
  }
}

// Save user's alert IDs list
async function saveUserAlertIds(kv: DevKV, userId: string, alertIds: string[]): Promise<boolean> {
  try {
    await kv.put(KV_KEYS.ALERTS + userId, JSON.stringify(alertIds));
    return true;
  } catch (error) {
    logger.error('Error saving user alert IDs:', error);
    return false;
  }
}

// Save alert
export async function saveAlert(kv: DevKV, userId: string, alert: KVAlert): Promise<boolean> {
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
    logger.error('Error saving alert:', error);
    return false;
  }
}

// Get alert
export async function getAlert(kv: DevKV, userId: string, alertId: string): Promise<KVAlert | null> {
  try {
    const alertKey = `${KV_KEYS.ALERT}${userId}:${alertId}`;
    const alertData = await kv.get(alertKey);
    return alertData ? JSON.parse(alertData) : null;
  } catch (error) {
    logger.error('Error getting alert:', error);
    return null;
  }
}

// Get all alerts for a user
export async function getUserAlerts(kv: DevKV, userId: string): Promise<KVAlert[]> {
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
    logger.error('Error getting user alerts:', error);
    return [];
  }
}

// Update alert
export async function updateAlert(kv: DevKV, userId: string, alertId: string, updates: Partial<KVAlert>): Promise<boolean> {
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
    logger.error('Error updating alert:', error);
    return false;
  }
}

// Delete alert
export async function deleteAlert(kv: DevKV, userId: string, alertId: string): Promise<boolean> {
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
    logger.error('Error deleting alert:', error);
    return false;
  }
}

// Helper to get all active "after" alerts for a specific user (for cron job)
export async function getActiveAfterAlerts(kv: DevKV, userId: string): Promise<KVAlert[]> {
  try {
    const allAlerts = await getUserAlerts(kv, userId);
    return allAlerts.filter(
      alert => alert.status === 'active' && alert.alertType === 'after'
    );
  } catch (error) {
    logger.error('Error getting active after alerts:', error);
    return [];
  }
}
