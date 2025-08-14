import type { KVUser, KVWatchlist } from './auth';
import type { KVInterface } from './kv-factory';

// In-memory storage for development (Edge-compatible)
// Use globalThis to persist cache across different API calls
const getDevStorageCache = () => {
  if (!globalThis.__devStorageCache) {
    globalThis.__devStorageCache = new Map<string, string>();
  }
  return globalThis.__devStorageCache;
};

declare global {
  var __devStorageCache: Map<string, string> | undefined;
}

// KV key prefixes for organization
export const KV_KEYS = {
  USER: 'user:',
  WATCHLIST: 'watchlist:',
  VERIFICATION: 'verify:',
  EMAIL_TO_USER: 'email:',
} as const;

// Using unified KV interface directly, no need for DevKV type alias

// Create development KV instance
export function createDevKV(): KVInterface {
  return {
    async get(key: string): Promise<string | null> {
      const cache = getDevStorageCache();
      console.log('KV GET:', key, 'Cache size:', cache.size);
      console.log('Cache keys:', Array.from(cache.keys()));
      const value = cache.get(key);
      console.log('KV GET result:', value ? value.substring(0, 50) + '...' : 'null');
      if (!value) return null;
      
      // Check if expired (for verification tokens)
      try {
        const parsed = JSON.parse(value);
        if (parsed.expiresAt && new Date(parsed.expiresAt) < new Date()) {
          getDevStorageCache().delete(key);
          return null;
        }
        // Return the actual value, not the JSON string
        return parsed.value || value;
      } catch {
        return value;
      }
    },

    async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
      console.log('KV PUT:', key, '=', value.substring(0, 50) + '...');
      if (options?.expirationTtl) {
        const expiresAt = new Date(Date.now() + options.expirationTtl * 1000);
        getDevStorageCache().set(key, JSON.stringify({ value, expiresAt }));
      } else {
        getDevStorageCache().set(key, value);
      }
      console.log('KV PUT complete. Cache size:', getDevStorageCache().size);
    },

    async putBatch(entries: { key: string; value: string; expirationTtl?: number }[]): Promise<void> {
      for (const entry of entries) {
        if (entry.expirationTtl) {
          const expiresAt = new Date(Date.now() + entry.expirationTtl * 1000);
          getDevStorageCache().set(entry.key, JSON.stringify({ value: entry.value, expiresAt }));
        } else {
          getDevStorageCache().set(entry.key, entry.value);
        }
      }
    },

    async delete(key: string | string[]): Promise<void> {
      if (Array.isArray(key)) {
        for (const k of key) {
          getDevStorageCache().delete(k);
        }
      } else {
        getDevStorageCache().delete(key);
      }
    }
  };
}

// Get user by ID
export async function getUserById(kv: KVInterface, userId: string): Promise<KVUser | null> {
  try {
    const userData = await kv.get(KV_KEYS.USER + userId);
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Error getting user by ID:', error);
    return null;
  }
}

// Get user by email
export async function getUserByEmail(kv: KVInterface, email: string): Promise<KVUser | null> {
  try {
    console.log('Getting user by email:', email);
    console.log('Looking for key:', KV_KEYS.EMAIL_TO_USER + email.toLowerCase());
    const userId = await kv.get(KV_KEYS.EMAIL_TO_USER + email.toLowerCase());
    console.log('Found userId:', userId);
    if (!userId) return null;
    
    return await getUserById(kv, userId);
  } catch (error) {
    console.error('Error getting user by email:', error);
    return null;
  }
}

// Save user
export async function saveUser(kv: KVInterface, user: KVUser): Promise<boolean> {
  try {
    console.log('saveUser called with:', user.id, user.email);
    
    // Save user data
    await kv.put(KV_KEYS.USER + user.id, JSON.stringify(user));
    console.log('User data saved');
    
    // Save email mapping (normalize to lowercase for consistent lookup)
    const emailKey = KV_KEYS.EMAIL_TO_USER + user.email.toLowerCase();
    console.log('Saving email mapping:', emailKey, '->', user.id);
    await kv.put(emailKey, user.id);
    console.log('Email mapping saved');
    
    return true;
  } catch (error) {
    console.error('Error saving user:', error);
    return false;
  }
}

// Update user
export async function updateUser(kv: KVInterface, user: KVUser): Promise<boolean> {
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
export async function deleteUser(kv: KVInterface, user: KVUser): Promise<boolean> {
  try {
    const batch = [
      { key: KV_KEYS.USER + user.id, value: '' },
      { key: KV_KEYS.EMAIL_TO_USER + user.email, value: '' },
      { key: KV_KEYS.WATCHLIST + user.id, value: '' }
    ];
    
    await kv.delete(batch.map(item => item.key));
    return true;
  } catch (error) {
    console.error('Error deleting user:', error);
    return false;
  }
}

// Get user's watchlist
export async function getWatchlist(kv: KVInterface, userId: string): Promise<KVWatchlist> {
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
export async function saveWatchlist(kv: KVInterface, userId: string, watchlist: KVWatchlist): Promise<boolean> {
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
export async function addTickerToWatchlist(kv: KVInterface, userId: string, symbol: string): Promise<boolean> {
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
export async function removeTickerFromWatchlist(kv: KVInterface, userId: string, symbol: string): Promise<boolean> {
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
export async function getVerificationToken(kv: KVInterface, token: string): Promise<string | null> {
  try {
    console.log('Looking up verification token:', token);
    const data = await kv.get(KV_KEYS.VERIFICATION + token);
    console.log('Raw token data from KV:', data);
    if (!data) return null;
    
    // Try to parse as JSON first (new format)
    try {
      const parsed = JSON.parse(data);
      const userId = parsed.value || parsed.userId;
      console.log('Parsed token data:', { parsed, userId });
      return userId || data;
    } catch {
      // If not JSON, return as plain string (old format)
      console.log('Token data is plain string:', data);
      return data;
    }
  } catch (error) {
    console.error('Error getting verification token:', error);
    return null;
  }
}

// Save verification token
export async function saveVerificationToken(kv: KVInterface, token: string, userId: string, expiresIn: number = 3600): Promise<boolean> {
  try {
    console.log('Saving verification token:', { token, userId, expiresIn });
    // Store with expiration, which will wrap in JSON with expiresAt
    await kv.put(KV_KEYS.VERIFICATION + token, userId, { expirationTtl: expiresIn });
    console.log('Verification token saved successfully');
    return true;
  } catch (error) {
    console.error('Error saving verification token:', error);
    return false;
  }
}

// Delete verification token
export async function deleteVerificationToken(kv: KVInterface, token: string): Promise<boolean> {
  try {
    await kv.delete(KV_KEYS.VERIFICATION + token);
    return true;
  } catch (error) {
    console.error('Error deleting verification token:', error);
    return false;
  }
}
