import { createDevKV } from './kv-dev-edge';

// KV interface that works for both dev and production
export interface KVInterface {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  putBatch(entries: { key: string; value: string; expirationTtl?: number }[]): Promise<void>;
  delete(key: string | string[]): Promise<void>;
}

// Create KV instance based on environment
export function createKV(): KVInterface {
  // Check if we have the actual KV namespace available
  const kvNamespace = (globalThis as Record<string, unknown>).TICKRTIME_KV as {
    get: (key: string) => Promise<string | null>;
    put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>;
    delete: (key: string | string[]) => Promise<void>;
  } | undefined;

  if (kvNamespace) {
    // We have the KV namespace, use Cloudflare KV
    return {
      get: kvNamespace.get.bind(kvNamespace),
      put: kvNamespace.put.bind(kvNamespace),
      putBatch: (entries) => Promise.all(entries.map(entry => kvNamespace.put(entry.key, entry.value, { expirationTtl: entry.expirationTtl }))).then(() => {}),
      delete: kvNamespace.delete.bind(kvNamespace)
    };
  } else {
    // No KV namespace available, use development KV
    return createDevKV();
  }
}

// Helper function to check if we're in production
export function isProduction(): boolean {
  // Check if we have the actual KV namespace available
  const kvNamespace = (globalThis as Record<string, unknown>).TICKRTIME_KV;
  return !!kvNamespace;
}
