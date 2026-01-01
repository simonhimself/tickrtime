import { vi } from 'vitest';
import { finnhubEarningsCalendar } from '../fixtures/test-data';

/**
 * Simple Finnhub API mock for integration tests
 *
 * Usage:
 *   const cleanup = setupFinnhubMock();
 *   // ... run tests ...
 *   cleanup(); // restore original fetch
 */

type FinnhubResponse = Record<string, unknown> | unknown[];

interface MockConfig {
  '/calendar/earnings': FinnhubResponse;
  '/stock/earnings': FinnhubResponse;
  '/stock/profile2': FinnhubResponse;
  '/stock/symbol': FinnhubResponse;
  [key: string]: FinnhubResponse;
}

const defaultResponses: MockConfig = {
  '/calendar/earnings': finnhubEarningsCalendar.normal,
  '/stock/earnings': [],
  '/stock/profile2': { finnhubIndustry: 'Technology' },
  '/stock/symbol': [
    { symbol: 'AAPL', description: 'Apple Inc' },
    { symbol: 'MSFT', description: 'Microsoft Corporation' },
  ],
};

export function setupFinnhubMock(customResponses?: Partial<MockConfig>) {
  const responses = { ...defaultResponses, ...customResponses };
  const originalFetch = globalThis.fetch;

  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();

    // Check if this is a Finnhub API call
    if (url.includes('finnhub.io')) {
      // Determine which endpoint
      for (const [endpoint, response] of Object.entries(responses)) {
        if (url.includes(endpoint.replace('/', ''))) {
          return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      // Default empty response for unknown endpoints
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fall back to original fetch for non-Finnhub URLs
    return originalFetch(input);
  });

  // Return cleanup function
  return () => {
    globalThis.fetch = originalFetch;
  };
}

/**
 * Create a mock Finnhub response for specific test scenarios
 */
export function createMockEarningsResponse(
  scenario: 'normal' | 'empty' | 'withInvalidEPS' | 'withNullValues' | 'withMixedCaseSymbols'
) {
  return finnhubEarningsCalendar[scenario];
}

/**
 * Create mock fetch that returns errors
 */
export function setupFinnhubErrorMock(statusCode: number = 500) {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.includes('finnhub.io')) {
      return new Response(JSON.stringify({ error: 'API Error' }), {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return originalFetch(input);
  });

  return () => {
    globalThis.fetch = originalFetch;
  };
}
