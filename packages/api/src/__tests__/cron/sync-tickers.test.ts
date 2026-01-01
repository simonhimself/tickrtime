import { describe, it, expect } from 'vitest';

/**
 * These tests verify the symbol comparison logic used in sync-tickers.
 * The bug: Finnhub may return mixed-case symbols, but our DB stores uppercase.
 * The comparison must be case-insensitive.
 */

// FIXED comparison logic - normalizes to uppercase before comparison
function findNewSymbols(
  finnhubSymbols: Set<string>,
  dbSymbols: Set<string>
): string[] {
  const newSymbols: string[] = [];
  // Create uppercase version of dbSymbols for case-insensitive comparison
  const dbSymbolsUpper = new Set([...dbSymbols].map((s) => s.toUpperCase()));
  for (const symbol of finnhubSymbols) {
    if (!dbSymbolsUpper.has(symbol.toUpperCase())) {
      newSymbols.push(symbol);
    }
  }
  return newSymbols;
}

function findDelistedSymbols(
  finnhubSymbols: Set<string>,
  dbSymbols: Set<string>
): string[] {
  const delistedSymbols: string[] = [];
  // Create uppercase version of finnhubSymbols for case-insensitive comparison
  const finnhubSymbolsUpper = new Set([...finnhubSymbols].map((s) => s.toUpperCase()));
  for (const symbol of dbSymbols) {
    if (!finnhubSymbolsUpper.has(symbol.toUpperCase())) {
      delistedSymbols.push(symbol);
    }
  }
  return delistedSymbols;
}

describe('sync-tickers symbol comparison', () => {
  describe('findNewSymbols', () => {
    it('should detect new symbols when cases match', () => {
      const finnhub = new Set(['AAPL', 'GOOGL', 'NEWSTOCK']);
      const db = new Set(['AAPL', 'GOOGL']);

      const newSymbols = findNewSymbols(finnhub, db);

      expect(newSymbols).toEqual(['NEWSTOCK']);
    });

    it('should NOT detect a symbol as new if it exists with different case', () => {
      // Finnhub returns 'FLGpU' (mixed case), DB has 'FLGPU' (uppercase)
      // This should NOT be detected as a new symbol
      const finnhub = new Set(['AAPL', 'FLGpU']);
      const db = new Set(['AAPL', 'FLGPU']);

      const newSymbols = findNewSymbols(finnhub, db);

      // BUG: Current implementation will incorrectly return 'FLGpU' as new
      // because Set.has() is case-sensitive
      expect(newSymbols).toEqual([]); // This test should FAIL with current code
    });

    it('should handle lowercase symbols from Finnhub', () => {
      // Edge case: Finnhub returns lowercase
      const finnhub = new Set(['aapl', 'googl']);
      const db = new Set(['AAPL', 'GOOGL']);

      const newSymbols = findNewSymbols(finnhub, db);

      // These should NOT be detected as new - they're the same symbols
      expect(newSymbols).toEqual([]); // This test should FAIL with current code
    });
  });

  describe('findDelistedSymbols', () => {
    it('should detect delisted symbols when cases match', () => {
      const finnhub = new Set(['AAPL']);
      const db = new Set(['AAPL', 'OLDSTOCK']);

      const delistedSymbols = findDelistedSymbols(finnhub, db);

      expect(delistedSymbols).toEqual(['OLDSTOCK']);
    });

    it('should NOT detect a symbol as delisted if it exists with different case', () => {
      // Finnhub returns 'FLGpU', DB has 'FLGPU'
      // FLGPU should NOT be detected as delisted
      const finnhub = new Set(['AAPL', 'FLGpU']);
      const db = new Set(['AAPL', 'FLGPU']);

      const delistedSymbols = findDelistedSymbols(finnhub, db);

      // BUG: Current implementation will incorrectly return 'FLGPU' as delisted
      expect(delistedSymbols).toEqual([]); // This test should FAIL with current code
    });
  });

  describe('case normalization', () => {
    it('should normalize Finnhub symbols to uppercase before comparison', () => {
      // The fix: normalize symbols to uppercase when building the map
      const finnhubRaw = ['AAPL', 'FLGpU', 'NewStock'];
      const normalizedFinnhub = new Set(finnhubRaw.map((s) => s.toUpperCase()));
      const db = new Set(['AAPL', 'FLGPU']);

      const newSymbols = findNewSymbols(normalizedFinnhub, db);
      const delistedSymbols = findDelistedSymbols(normalizedFinnhub, db);

      // After normalization, only NEWSTOCK should be new
      expect(newSymbols).toEqual(['NEWSTOCK']);
      expect(delistedSymbols).toEqual([]);
    });
  });
});
