import { describe, it, expect } from 'vitest';
import { parseEPS, calculateSurprise } from '../../lib/earnings-utils';

describe('parseEPS', () => {
  it('returns null for undefined input', () => {
    expect(parseEPS(undefined)).toBeNull();
  });

  it('returns null for null input', () => {
    expect(parseEPS(null)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseEPS('')).toBeNull();
    expect(parseEPS('   ')).toBeNull();
  });

  it('returns null for non-numeric strings like "N/A" (prevents NaN propagation)', () => {
    // This is the critical bug fix - parseFloat("N/A") returns NaN
    // Our function should return null instead
    expect(parseEPS('N/A')).toBeNull();
    expect(parseEPS('--')).toBeNull();
    expect(parseEPS('TBD')).toBeNull();
    expect(parseEPS('invalid')).toBeNull();
  });

  it('parses valid numeric strings', () => {
    expect(parseEPS('1.50')).toBe(1.50);
    expect(parseEPS('0.75')).toBe(0.75);
    expect(parseEPS('-0.50')).toBe(-0.50);
    expect(parseEPS('0')).toBe(0);
    expect(parseEPS('0.00')).toBe(0);
  });

  it('passes through valid numbers unchanged', () => {
    expect(parseEPS(1.50)).toBe(1.50);
    expect(parseEPS(0)).toBe(0);
    expect(parseEPS(-0.75)).toBe(-0.75);
  });

  it('returns null for NaN input', () => {
    expect(parseEPS(NaN)).toBeNull();
  });
});

describe('calculateSurprise', () => {
  it('returns nulls when actual is null', () => {
    const result = calculateSurprise(null, 1.50);
    expect(result.surprise).toBeNull();
    expect(result.surprisePercent).toBeNull();
  });

  it('returns nulls when estimate is null', () => {
    const result = calculateSurprise(1.50, null);
    expect(result.surprise).toBeNull();
    expect(result.surprisePercent).toBeNull();
  });

  it('returns nulls when actual is NaN', () => {
    const result = calculateSurprise(NaN, 1.50);
    expect(result.surprise).toBeNull();
    expect(result.surprisePercent).toBeNull();
  });

  it('calculates surprise correctly but returns null surprisePercent when estimate is zero', () => {
    const result = calculateSurprise(1.50, 0);
    expect(result.surprise).toBe(1.50);
    expect(result.surprisePercent).toBeNull();
  });

  it('calculates positive surprise correctly', () => {
    const result = calculateSurprise(1.60, 1.50);
    expect(result.surprise).toBeCloseTo(0.10, 2);
    // (1.60 - 1.50) / |1.50| * 100 = 6.67%
    expect(result.surprisePercent).toBeCloseTo(6.67, 1);
  });

  it('calculates negative surprise correctly', () => {
    const result = calculateSurprise(1.40, 1.50);
    expect(result.surprise).toBeCloseTo(-0.10, 2);
    // (1.40 - 1.50) / |1.50| * 100 = -6.67%
    expect(result.surprisePercent).toBeCloseTo(-6.67, 1);
  });

  it('handles negative estimate correctly (uses absolute value)', () => {
    // If company was expected to lose $1, but lost only $0.50
    const result = calculateSurprise(-0.50, -1.00);
    expect(result.surprise).toBeCloseTo(0.50, 2);
    // (-0.50 - (-1.00)) / |-1.00| * 100 = 50%
    expect(result.surprisePercent).toBeCloseTo(50, 1);
  });
});
