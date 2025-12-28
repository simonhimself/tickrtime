import type { KVNamespace } from '@cloudflare/workers-types';
import { logger } from './logger';

const KV_KEYS = {
  VERIFICATION: 'verify:',
  PASSWORD_RESET: 'reset:',
  WATCHLIST: 'watchlist:',
} as const;

export async function saveVerificationToken(
  kv: KVNamespace,
  token: string,
  userId: string,
  ttl: number
): Promise<void> {
  try {
    await kv.put(KV_KEYS.VERIFICATION + token, userId, { expirationTtl: ttl });
    logger.debug('Saved verification token to KV');
  } catch (error) {
    logger.error('Error saving verification token:', error);
    throw error;
  }
}

export async function getVerificationToken(
  kv: KVNamespace,
  token: string
): Promise<string | null> {
  try {
    const userId = await kv.get(KV_KEYS.VERIFICATION + token);
    return userId;
  } catch (error) {
    logger.error('Error getting verification token:', error);
    return null;
  }
}

export async function deleteVerificationToken(
  kv: KVNamespace,
  token: string
): Promise<void> {
  try {
    await kv.delete(KV_KEYS.VERIFICATION + token);
    logger.debug('Deleted verification token from KV');
  } catch (error) {
    logger.error('Error deleting verification token:', error);
  }
}

export async function savePasswordResetToken(
  kv: KVNamespace,
  token: string,
  userId: string,
  ttl: number
): Promise<void> {
  try {
    await kv.put(KV_KEYS.PASSWORD_RESET + token, userId, { expirationTtl: ttl });
    logger.debug('Saved password reset token to KV');
  } catch (error) {
    logger.error('Error saving password reset token:', error);
    throw error;
  }
}

export async function getPasswordResetToken(
  kv: KVNamespace,
  token: string
): Promise<string | null> {
  try {
    const userId = await kv.get(KV_KEYS.PASSWORD_RESET + token);
    return userId;
  } catch (error) {
    logger.error('Error getting password reset token:', error);
    return null;
  }
}

export async function deletePasswordResetToken(
  kv: KVNamespace,
  token: string
): Promise<void> {
  try {
    await kv.delete(KV_KEYS.PASSWORD_RESET + token);
    logger.debug('Deleted password reset token from KV');
  } catch (error) {
    logger.error('Error deleting password reset token:', error);
  }
}

export async function deleteWatchlist(
  kv: KVNamespace,
  userId: string
): Promise<void> {
  try {
    await kv.delete(KV_KEYS.WATCHLIST + userId);
    logger.debug('Deleted watchlist from KV for user:', userId);
  } catch (error) {
    logger.error('Error deleting watchlist:', error);
  }
}





