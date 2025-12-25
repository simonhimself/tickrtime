/**
 * Centralized Logger Utility for Worker
 */

export function createLogger(prefix: string) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  return {
    debug: (...args: unknown[]) => {
      if (isDevelopment) {
        console.log(`[${prefix}]`, ...args);
      }
    },
    info: (...args: unknown[]) => {
      if (isDevelopment) {
        console.info(`[${prefix}]`, ...args);
      }
    },
    warn: (...args: unknown[]) => {
      if (isDevelopment) {
        console.warn(`[${prefix}]`, ...args);
      }
    },
    error: (...args: unknown[]) => {
      console.error(`[${prefix}]`, ...args);
    },
    child: (subPrefix: string) => createLogger(`${prefix}:${subPrefix}`)
  };
}

export const logger = createLogger('api');

