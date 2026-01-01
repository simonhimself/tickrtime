/**
 * Date utilities for earnings calculations
 * Extracted for testability and consistent timezone handling
 */

export interface DateRange {
  start: string;
  end: string;
}

/**
 * Get today's date as YYYY-MM-DD string in UTC
 *
 * Note: Finnhub dates are in ET (Eastern Time), but we use UTC for consistency.
 * This may cause off-by-one issues near midnight - see tests for edge cases.
 */
export function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0]!;
}

/**
 * Get a date N days from today as YYYY-MM-DD string
 */
export function getDateOffsetString(daysOffset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split('T')[0]!;
}

/**
 * Split a date range into month-based ranges for Finnhub API
 * Finnhub requires separate API calls for each month
 *
 * @param fromDate - Start date (YYYY-MM-DD)
 * @param toDate - End date (YYYY-MM-DD)
 * @returns Array of date ranges, one per month spanned
 */
export function splitIntoMonthRanges(fromDate: string, toDate: string): DateRange[] {
  const ranges: DateRange[] = [];

  const start = new Date(fromDate + 'T00:00:00Z');
  const end = new Date(toDate + 'T00:00:00Z');

  // If same month, return single range
  if (start.getUTCFullYear() === end.getUTCFullYear() &&
      start.getUTCMonth() === end.getUTCMonth()) {
    return [{ start: fromDate, end: toDate }];
  }

  let currentStart = new Date(start);

  while (currentStart <= end) {
    const year = currentStart.getUTCFullYear();
    const month = currentStart.getUTCMonth();

    // Get last day of current month
    const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0));

    // Range end is either last day of month or the final end date
    const rangeEnd = lastDayOfMonth <= end ? lastDayOfMonth : end;

    ranges.push({
      start: currentStart.toISOString().split('T')[0]!,
      end: rangeEnd.toISOString().split('T')[0]!,
    });

    // Move to first day of next month
    currentStart = new Date(Date.UTC(year, month + 1, 1));
  }

  return ranges;
}

/**
 * Normalize a symbol to uppercase
 * Handles mixed-case symbols from Finnhub (e.g., "FLGpU" -> "FLGPU")
 */
export function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

/**
 * Compare two symbols case-insensitively
 */
export function symbolsEqual(a: string, b: string): boolean {
  return normalizeSymbol(a) === normalizeSymbol(b);
}
