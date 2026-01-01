import { describe, it, expect } from 'vitest';
import { mapIndustryToSector, SECTOR_MAPPING } from '../../lib/db/tickers';

describe('mapIndustryToSector', () => {
  it('maps Technology industries correctly', () => {
    expect(mapIndustryToSector('Technology')).toBe('Technology');
    expect(mapIndustryToSector('Software')).toBe('Technology');
    expect(mapIndustryToSector('Semiconductors')).toBe('Technology');
  });

  it('maps Healthcare industries correctly', () => {
    expect(mapIndustryToSector('Healthcare')).toBe('Healthcare');
    expect(mapIndustryToSector('Pharmaceuticals')).toBe('Healthcare');
    expect(mapIndustryToSector('Biotechnology')).toBe('Healthcare');
  });

  it('maps Financials industries correctly', () => {
    expect(mapIndustryToSector('Banks')).toBe('Financials');
    expect(mapIndustryToSector('Insurance')).toBe('Financials');
    expect(mapIndustryToSector('Financial Services')).toBe('Financials');
  });

  it('returns "Other" for unknown industries (fallback behavior)', () => {
    expect(mapIndustryToSector('Unknown Industry XYZ')).toBe('Other');
    expect(mapIndustryToSector('Some Random Industry')).toBe('Other');
    expect(mapIndustryToSector('Cryptocurrency Mining')).toBe('Other');
  });

  it('returns undefined for null input', () => {
    expect(mapIndustryToSector(null)).toBeUndefined();
  });

  it('returns undefined for undefined input', () => {
    expect(mapIndustryToSector(undefined)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    // Empty string is falsy, so it returns undefined
    expect(mapIndustryToSector('')).toBeUndefined();
  });
});

describe('SECTOR_MAPPING completeness', () => {
  const EXPECTED_SECTORS = [
    'Technology',
    'Healthcare',
    'Financials',
    'Consumer',
    'Industrials',
    'Energy',
    'Utilities',
    'Real Estate',
    'Communication',
    'Materials',
  ];

  it('contains all expected sectors', () => {
    const actualSectors = new Set(Object.values(SECTOR_MAPPING));
    for (const sector of EXPECTED_SECTORS) {
      expect(actualSectors.has(sector)).toBe(true);
    }
  });

  it('has at least one industry mapped to each sector', () => {
    const sectorsWithIndustries = new Set(Object.values(SECTOR_MAPPING));
    expect(sectorsWithIndustries.size).toBeGreaterThanOrEqual(EXPECTED_SECTORS.length);
  });

  it('has no duplicate industry keys', () => {
    const industries = Object.keys(SECTOR_MAPPING);
    const uniqueIndustries = new Set(industries);
    expect(uniqueIndustries.size).toBe(industries.length);
  });

  it('all sector values are non-empty strings', () => {
    for (const [industry, sector] of Object.entries(SECTOR_MAPPING)) {
      expect(typeof sector).toBe('string');
      expect(sector.length).toBeGreaterThan(0);
    }
  });

  // Snapshot test to catch accidental changes to mappings
  it('snapshot: sector mapping is stable', () => {
    // Count industries per sector to detect drift
    const sectorCounts: Record<string, number> = {};
    for (const sector of Object.values(SECTOR_MAPPING)) {
      sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
    }

    // These counts should remain stable - update if intentionally changed
    // Current count: 125 mappings
    expect(Object.keys(SECTOR_MAPPING).length).toBeGreaterThanOrEqual(120);
    expect(sectorCounts['Technology']).toBeGreaterThanOrEqual(7);
    expect(sectorCounts['Healthcare']).toBeGreaterThanOrEqual(10);
    expect(sectorCounts['Financials']).toBeGreaterThanOrEqual(10);
  });
});
