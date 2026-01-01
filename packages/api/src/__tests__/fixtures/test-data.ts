/**
 * Test fixtures for TickrTime API tests
 */

// Finnhub earnings calendar response fixtures
export const finnhubEarningsCalendar = {
  normal: {
    earningsCalendar: [
      {
        symbol: 'AAPL',
        date: '2024-12-15',
        hour: 'amc',
        quarter: 4,
        year: 2024,
        epsActual: 1.50,
        epsEstimate: 1.45,
      },
      {
        symbol: 'MSFT',
        date: '2024-12-15',
        hour: 'bmo',
        quarter: 4,
        year: 2024,
        epsActual: 2.10,
        epsEstimate: 2.00,
      },
    ],
  },
  empty: {
    earningsCalendar: [],
  },
  withInvalidEPS: {
    earningsCalendar: [
      {
        symbol: 'AAPL',
        date: '2024-12-15',
        hour: 'amc',
        quarter: 4,
        year: 2024,
        epsActual: 'N/A', // Invalid string - should become null
        epsEstimate: 1.45,
      },
    ],
  },
  withNullValues: {
    earningsCalendar: [
      {
        symbol: 'AAPL',
        date: '2024-12-15',
        hour: 'amc',
        quarter: 4,
        year: 2024,
        epsActual: null,
        epsEstimate: null,
      },
    ],
  },
  withMixedCaseSymbols: {
    earningsCalendar: [
      {
        symbol: 'FLGpU', // Mixed case - known issue
        date: '2024-12-15',
        hour: 'amc',
        quarter: 4,
        year: 2024,
        epsActual: 0.50,
        epsEstimate: 0.45,
      },
    ],
  },
};

// Test tickers
export const testTickers = {
  apple: {
    symbol: 'AAPL',
    description: 'Apple Inc',
    exchange: 'NASDAQ',
    industry: 'Technology',
    sector: 'Technology',
    is_active: 1,
    profile_fetched_at: '2024-01-01T00:00:00Z',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  microsoft: {
    symbol: 'MSFT',
    description: 'Microsoft Corporation',
    exchange: 'NASDAQ',
    industry: 'Software',
    sector: 'Technology',
    is_active: 1,
    profile_fetched_at: '2024-01-01T00:00:00Z',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  inactive: {
    symbol: 'DELIST',
    description: 'Delisted Company',
    exchange: 'NYSE',
    industry: 'Technology',
    sector: 'Technology',
    is_active: 0,
    profile_fetched_at: '2024-01-01T00:00:00Z',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  unknownIndustry: {
    symbol: 'UNKN',
    description: 'Unknown Industry Corp',
    exchange: 'NYSE',
    industry: null,
    sector: null,
    is_active: 1,
    profile_fetched_at: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
};

// Test users
export const testUsers = {
  verified: {
    id: 'user-123',
    email: 'test@example.com',
    email_normalized: 'test@example.com',
    password_hash: '$2a$10$hashedpassword',
    email_verified: 1,
    notification_preferences: JSON.stringify({
      emailEnabled: true,
      defaultDaysBefore: 2,
      defaultDaysAfter: 0,
    }),
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  unverified: {
    id: 'user-456',
    email: 'unverified@example.com',
    email_normalized: 'unverified@example.com',
    password_hash: '$2a$10$hashedpassword',
    email_verified: 0,
    notification_preferences: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
};

// Test alerts
export const testAlerts = {
  beforeAlert: {
    id: 'alert-1',
    user_id: 'user-123',
    symbol: 'AAPL',
    alert_type: 'before',
    days_before: 2,
    days_after: null,
    recurring: 0,
    earnings_date: '2024-12-15',
    scheduled_email_id: 'email-123',
    status: 'active',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  afterAlert: {
    id: 'alert-2',
    user_id: 'user-123',
    symbol: 'MSFT',
    alert_type: 'after',
    days_before: null,
    days_after: 1,
    recurring: 0,
    earnings_date: '2024-12-15',
    scheduled_email_id: null,
    status: 'active',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  recurringAlert: {
    id: 'alert-3',
    user_id: 'user-123',
    symbol: 'GOOGL',
    alert_type: 'after',
    days_before: null,
    days_after: 0,
    recurring: 1,
    earnings_date: '2024-12-15',
    scheduled_email_id: null,
    status: 'active',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
};

// Expected processed earnings (after our utility functions)
export const expectedProcessedEarnings = {
  normal: [
    {
      symbol: 'AAPL',
      date: '2024-12-15',
      actual: 1.50,
      estimate: 1.45,
      surprise: 0.05,
      surprisePercent: 3.45, // (1.50 - 1.45) / 1.45 * 100
      hour: 'amc',
      quarter: 4,
      year: 2024,
    },
    {
      symbol: 'MSFT',
      date: '2024-12-15',
      actual: 2.10,
      estimate: 2.00,
      surprise: 0.10,
      surprisePercent: 5.00, // (2.10 - 2.00) / 2.00 * 100
      hour: 'bmo',
      quarter: 4,
      year: 2024,
    },
  ],
  withInvalidEPS: [
    {
      symbol: 'AAPL',
      date: '2024-12-15',
      actual: null, // 'N/A' converted to null
      estimate: 1.45,
      surprise: null, // Can't calculate with null actual
      surprisePercent: null,
      hour: 'amc',
      quarter: 4,
      year: 2024,
    },
  ],
};

// Helper to get future date string
export function getFutureDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split('T')[0]!;
}

// Helper to get past date string
export function getPastDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0]!;
}
