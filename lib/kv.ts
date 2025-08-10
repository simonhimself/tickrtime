import type { KVUser, KVWatchlist } from './auth';

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
