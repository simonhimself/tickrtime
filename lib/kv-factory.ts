import { createDevKV } from './kv-dev-edge';
import { getRequestContext } from '@cloudflare/next-on-pages';

// Declare Cloudflare KV namespace type
declare global {
  interface CloudflareEnv {
    TICKRTIME_KV: KVNamespace;
  }
}

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string | string[]): Promise<void>;
}

// KV interface that works for both dev and production
export interface KVInterface {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  putBatch(entries: { key: string; value: string; expirationTtl?: number }[]): Promise<void>;
  delete(key: string | string[]): Promise<void>;
}

// Create KV instance based on environment
export function createKV(): KVInterface {
  try {
    // Try to get KV namespace from Cloudflare request context
    const { env } = getRequestContext();
    const kvNamespace = env.TICKRTIME_KV;

    if (kvNamespace) {
      console.log('Using Cloudflare KV namespace from request context');
      return {
        get: kvNamespace.get.bind(kvNamespace),
        put: kvNamespace.put.bind(kvNamespace),
        putBatch: (entries) => Promise.all(entries.map(entry => kvNamespace.put(entry.key, entry.value, { expirationTtl: entry.expirationTtl }))).then(() => {}),
        delete: kvNamespace.delete.bind(kvNamespace)
      };
    }
  } catch (e) {
    // getRequestContext() throws if not in Cloudflare context
    console.log('Not in Cloudflare context, checking globalThis');
  }

  // Fallback: Check globalThis (for production deployment)
  const kvNamespace = (globalThis as Record<string, unknown>).TICKRTIME_KV as {
    get: (key: string) => Promise<string | null>;
    put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>;
    delete: (key: string | string[]) => Promise<void>;
  } | undefined;

  if (kvNamespace) {
    console.log('Using Cloudflare KV namespace from globalThis');
    return {
      get: kvNamespace.get.bind(kvNamespace),
      put: kvNamespace.put.bind(kvNamespace),
      putBatch: (entries) => Promise.all(entries.map(entry => kvNamespace.put(entry.key, entry.value, { expirationTtl: entry.expirationTtl }))).then(() => {}),
      delete: kvNamespace.delete.bind(kvNamespace)
    };
  }

  console.log('Using in-memory development KV');
  // No KV namespace available, use development KV
  return createDevKV();
}

// Helper function to check if we're in production
export function isProduction(): boolean {
  // Check if we have the actual KV namespace available
  const kvNamespace = (globalThis as Record<string, unknown>).TICKRTIME_KV;
  return !!kvNamespace;
}
