/**
 * Centralized Logger Utility
 * ===========================
 * 
 * IMPORTANT: Always use this logger instead of console.log!
 * 
 * Why this exists:
 * - Prevents sensitive data from being logged in production
 * - Improves performance by reducing production logs
 * - Provides consistent logging format across the application
 * 
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   
 *   logger.debug('Debug info');     // Only in development
 *   logger.info('Info message');    // Only in development
 *   logger.warn('Warning');         // Only in development
 *   logger.error('Error occurred'); // Always logs (even in production)
 * 
 * ESLint will warn you if you use console.log directly!
 */

// Safely check for development mode (works in both Node.js and Edge Runtime)
const isDevelopment = (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') || 
                      (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_ENV === 'development') ||
                      false;

export const logger = {
  /**
   * Debug level - for detailed debugging information
   * Only logs in development
   */
  debug: (...args: unknown[]) => {
    if (isDevelopment) {
      // eslint-disable-next-line no-console
      console.log('[DEBUG]', ...args);
    }
  },
  
  /**
   * Info level - for general information
   * Only logs in development
   */
  info: (...args: unknown[]) => {
    if (isDevelopment) {
      // eslint-disable-next-line no-console
      console.info('[INFO]', ...args);
    }
  },
  
  /**
   * Warning level - for warning messages
   * Only logs in development
   */
  warn: (...args: unknown[]) => {
    if (isDevelopment) {
      // eslint-disable-next-line no-console
      console.warn('[WARN]', ...args);
    }
  },
  
  /**
   * Error level - for error messages
   * ALWAYS logs, even in production (critical issues need visibility)
   */
  error: (...args: unknown[]) => {
    // Always log errors, even in production
    // eslint-disable-next-line no-console
    console.error('[ERROR]', ...args);
  }
};