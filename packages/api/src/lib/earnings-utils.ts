/**
 * Earnings calculation utilities
 * Extracted for testability and consistent behavior across routes
 */

export interface SurpriseResult {
  surprise: number | null;
  surprisePercent: number | null;
}

/**
 * Parse EPS value from Finnhub API response
 * Handles: number, string (parseable), null, undefined, and invalid strings
 *
 * @returns number if valid, null otherwise (NEVER returns NaN)
 */
export function parseEPS(value: unknown): number | null {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return null;
  }

  // Handle numbers directly
  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }

  // Handle strings
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return null;
    }
    const parsed = parseFloat(trimmed);
    return isNaN(parsed) ? null : parsed;
  }

  // Any other type returns null
  return null;
}

/**
 * Calculate earnings surprise and surprise percentage
 *
 * @param actual - Actual EPS value
 * @param estimate - Estimated EPS value
 * @returns Object with surprise (actual - estimate) and surprisePercent
 */
export function calculateSurprise(
  actual: number | null,
  estimate: number | null
): SurpriseResult {
  // Return nulls if either value is missing or NaN
  if (actual === null || estimate === null) {
    return { surprise: null, surprisePercent: null };
  }

  if (isNaN(actual) || isNaN(estimate)) {
    return { surprise: null, surprisePercent: null };
  }

  const surprise = actual - estimate;

  // Avoid division by zero - surprisePercent is null when estimate is 0
  const surprisePercent = estimate !== 0
    ? ((actual - estimate) / Math.abs(estimate)) * 100
    : null;

  return { surprise, surprisePercent };
}
