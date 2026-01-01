import { describe, it, expect } from 'vitest';
import { parseEPS, calculateSurprise } from '../../lib/earnings-utils';
import { finnhubEarningsCalendar, expectedProcessedEarnings } from '../fixtures/test-data';

/**
 * Integration tests for earnings data processing
 *
 * These tests verify the complete data flow from Finnhub response format
 * through our processing utilities to the final API response format.
 */

// Simulate the processEarningsData function logic
function processEarningsItem(item: {
  symbol: string;
  date: string;
  epsActual?: number | string | null;
  epsEstimate?: number | string | null;
  hour?: string;
  quarter?: number;
  year?: number;
}) {
  const actual = parseEPS(item.epsActual);
  const estimate = parseEPS(item.epsEstimate);
  const { surprise, surprisePercent } = calculateSurprise(actual, estimate);

  return {
    symbol: item.symbol,
    date: item.date,
    actual,
    estimate,
    surprise,
    surprisePercent,
    hour: item.hour,
    quarter: item.quarter,
    year: item.year,
  };
}

describe('Earnings Data Processing Flow', () => {
  describe('normal earnings data', () => {
    it('processes valid Finnhub response into correct API format', () => {
      const finnhubData = finnhubEarningsCalendar.normal.earningsCalendar;
      const processed = finnhubData.map(processEarningsItem);

      expect(processed).toHaveLength(2);

      // Check AAPL
      expect(processed[0].symbol).toBe('AAPL');
      expect(processed[0].actual).toBe(1.50);
      expect(processed[0].estimate).toBe(1.45);
      expect(processed[0].surprise).toBeCloseTo(0.05, 2);
      expect(processed[0].surprisePercent).toBeCloseTo(3.45, 1);

      // Check MSFT
      expect(processed[1].symbol).toBe('MSFT');
      expect(processed[1].actual).toBe(2.10);
      expect(processed[1].estimate).toBe(2.00);
      expect(processed[1].surprise).toBeCloseTo(0.10, 2);
      expect(processed[1].surprisePercent).toBeCloseTo(5.0, 1);
    });

    it('preserves all metadata fields', () => {
      const finnhubData = finnhubEarningsCalendar.normal.earningsCalendar;
      const processed = finnhubData.map(processEarningsItem);

      expect(processed[0].hour).toBe('amc');
      expect(processed[0].quarter).toBe(4);
      expect(processed[0].year).toBe(2024);
      expect(processed[0].date).toBe('2024-12-15');
    });
  });

  describe('invalid EPS handling', () => {
    it('converts "N/A" string to null (prevents NaN in response)', () => {
      const finnhubData = finnhubEarningsCalendar.withInvalidEPS.earningsCalendar;
      const processed = finnhubData.map(processEarningsItem);

      expect(processed[0].actual).toBeNull();
      expect(processed[0].estimate).toBe(1.45);
      expect(processed[0].surprise).toBeNull();
      expect(processed[0].surprisePercent).toBeNull();
    });

    it('handles null EPS values from Finnhub', () => {
      const finnhubData = finnhubEarningsCalendar.withNullValues.earningsCalendar;
      const processed = finnhubData.map(processEarningsItem);

      expect(processed[0].actual).toBeNull();
      expect(processed[0].estimate).toBeNull();
      expect(processed[0].surprise).toBeNull();
      expect(processed[0].surprisePercent).toBeNull();
    });
  });

  describe('empty response handling', () => {
    it('returns empty array for empty Finnhub response', () => {
      const finnhubData = finnhubEarningsCalendar.empty.earningsCalendar;
      const processed = finnhubData.map(processEarningsItem);

      expect(processed).toEqual([]);
    });
  });

  describe('response shape validation', () => {
    it('all earnings have required fields (never undefined)', () => {
      const finnhubData = finnhubEarningsCalendar.normal.earningsCalendar;
      const processed = finnhubData.map(processEarningsItem);

      for (const earning of processed) {
        // Required fields must exist (not undefined)
        expect(earning).toHaveProperty('symbol');
        expect(earning).toHaveProperty('date');
        expect(earning).toHaveProperty('actual');
        expect(earning).toHaveProperty('estimate');
        expect(earning).toHaveProperty('surprise');
        expect(earning).toHaveProperty('surprisePercent');

        // Types must be correct
        expect(typeof earning.symbol).toBe('string');
        expect(typeof earning.date).toBe('string');
        expect(earning.date).toMatch(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD

        // Numeric fields are number or null (never NaN)
        if (earning.actual !== null) {
          expect(typeof earning.actual).toBe('number');
          expect(Number.isNaN(earning.actual)).toBe(false);
        }
        if (earning.estimate !== null) {
          expect(typeof earning.estimate).toBe('number');
          expect(Number.isNaN(earning.estimate)).toBe(false);
        }
        if (earning.surprise !== null) {
          expect(typeof earning.surprise).toBe('number');
          expect(Number.isNaN(earning.surprise)).toBe(false);
        }
        if (earning.surprisePercent !== null) {
          expect(typeof earning.surprisePercent).toBe('number');
          expect(Number.isNaN(earning.surprisePercent)).toBe(false);
        }
      }
    });
  });

  describe('edge cases', () => {
    it('handles mixed case symbols correctly', () => {
      const finnhubData = finnhubEarningsCalendar.withMixedCaseSymbols.earningsCalendar;
      const processed = finnhubData.map(processEarningsItem);

      // The symbol should be preserved as-is from Finnhub
      // Normalization happens at the filtering/lookup stage, not processing
      expect(processed[0].symbol).toBe('FLGpU');
    });

    it('handles zero estimate (no division by zero)', () => {
      const item = {
        symbol: 'TEST',
        date: '2024-12-15',
        epsActual: 1.50,
        epsEstimate: 0,
      };

      const processed = processEarningsItem(item);

      expect(processed.actual).toBe(1.50);
      expect(processed.estimate).toBe(0);
      expect(processed.surprise).toBe(1.50);
      expect(processed.surprisePercent).toBeNull(); // Can't calculate % with zero estimate
    });

    it('handles negative earnings correctly', () => {
      const item = {
        symbol: 'TEST',
        date: '2024-12-15',
        epsActual: -0.50,
        epsEstimate: -1.00,
      };

      const processed = processEarningsItem(item);

      expect(processed.actual).toBe(-0.50);
      expect(processed.estimate).toBe(-1.00);
      expect(processed.surprise).toBe(0.50); // Beat expectations (less negative)
      expect(processed.surprisePercent).toBeCloseTo(50, 1); // 50% beat
    });
  });
});
