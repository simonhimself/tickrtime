import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getTodayDateString,
  getDateOffsetString,
  splitIntoMonthRanges,
  normalizeSymbol,
  symbolsEqual,
} from '../../lib/date-utils';

describe('getTodayDateString', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns YYYY-MM-DD format', () => {
    vi.setSystemTime(new Date('2024-12-15T12:00:00Z'));
    expect(getTodayDateString()).toBe('2024-12-15');
  });

  it('returns correct date at midnight UTC', () => {
    vi.setSystemTime(new Date('2024-12-16T00:00:00Z'));
    expect(getTodayDateString()).toBe('2024-12-16');
  });

  it('returns correct date at 11 PM UTC (edge case for ET timezone mismatch)', () => {
    // At 11 PM UTC, it's 6 PM ET (same day) or 7 PM ET (DST)
    // The function returns UTC date, which may differ from ET date near midnight
    vi.setSystemTime(new Date('2024-12-15T23:00:00Z'));
    expect(getTodayDateString()).toBe('2024-12-15');
  });

  it('handles year boundary correctly', () => {
    vi.setSystemTime(new Date('2024-12-31T23:59:59Z'));
    expect(getTodayDateString()).toBe('2024-12-31');

    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    expect(getTodayDateString()).toBe('2025-01-01');
  });
});

describe('getDateOffsetString', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns correct date for positive offset', () => {
    vi.setSystemTime(new Date('2024-12-15T12:00:00Z'));
    expect(getDateOffsetString(30)).toBe('2025-01-14');
  });

  it('returns correct date for negative offset', () => {
    vi.setSystemTime(new Date('2024-12-15T12:00:00Z'));
    expect(getDateOffsetString(-30)).toBe('2024-11-15');
  });

  it('returns today for zero offset', () => {
    vi.setSystemTime(new Date('2024-12-15T12:00:00Z'));
    expect(getDateOffsetString(0)).toBe('2024-12-15');
  });

  it('handles year boundary correctly', () => {
    vi.setSystemTime(new Date('2024-12-20T12:00:00Z'));
    expect(getDateOffsetString(15)).toBe('2025-01-04');
  });
});

describe('splitIntoMonthRanges', () => {
  it('returns single range when dates are in same month', () => {
    const ranges = splitIntoMonthRanges('2024-12-01', '2024-12-25');
    expect(ranges).toHaveLength(1);
    expect(ranges[0]).toEqual({ start: '2024-12-01', end: '2024-12-25' });
  });

  it('splits December to January range into two queries', () => {
    const ranges = splitIntoMonthRanges('2024-12-15', '2025-01-14');
    expect(ranges).toHaveLength(2);
    expect(ranges[0]).toEqual({ start: '2024-12-15', end: '2024-12-31' });
    expect(ranges[1]).toEqual({ start: '2025-01-01', end: '2025-01-14' });
  });

  it('handles 3-month span correctly', () => {
    const ranges = splitIntoMonthRanges('2024-11-15', '2025-01-15');
    expect(ranges).toHaveLength(3);
    expect(ranges[0]).toEqual({ start: '2024-11-15', end: '2024-11-30' });
    expect(ranges[1]).toEqual({ start: '2024-12-01', end: '2024-12-31' });
    expect(ranges[2]).toEqual({ start: '2025-01-01', end: '2025-01-15' });
  });

  it('handles February correctly in leap year', () => {
    const ranges = splitIntoMonthRanges('2024-02-15', '2024-03-15');
    expect(ranges).toHaveLength(2);
    expect(ranges[0]).toEqual({ start: '2024-02-15', end: '2024-02-29' }); // Leap year
    expect(ranges[1]).toEqual({ start: '2024-03-01', end: '2024-03-15' });
  });

  it('handles February correctly in non-leap year', () => {
    const ranges = splitIntoMonthRanges('2023-02-15', '2023-03-15');
    expect(ranges).toHaveLength(2);
    expect(ranges[0]).toEqual({ start: '2023-02-15', end: '2023-02-28' });
    expect(ranges[1]).toEqual({ start: '2023-03-01', end: '2023-03-15' });
  });
});

describe('normalizeSymbol', () => {
  it('converts lowercase to uppercase', () => {
    expect(normalizeSymbol('aapl')).toBe('AAPL');
  });

  it('handles mixed case like FLGpU (known bug case)', () => {
    expect(normalizeSymbol('FLGpU')).toBe('FLGPU');
  });

  it('preserves already uppercase symbols', () => {
    expect(normalizeSymbol('GOOGL')).toBe('GOOGL');
  });

  it('trims whitespace', () => {
    expect(normalizeSymbol('  AAPL  ')).toBe('AAPL');
    expect(normalizeSymbol('\tMSFT\n')).toBe('MSFT');
  });
});

describe('symbolsEqual', () => {
  it('compares symbols case-insensitively', () => {
    expect(symbolsEqual('AAPL', 'aapl')).toBe(true);
    expect(symbolsEqual('FLGpU', 'FLGPU')).toBe(true);
  });

  it('returns false for different symbols', () => {
    expect(symbolsEqual('AAPL', 'MSFT')).toBe(false);
  });
});
