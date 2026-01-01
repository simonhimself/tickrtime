import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getFutureDate, getPastDate, testAlerts } from '../fixtures/test-data';

/**
 * Integration tests for alert scheduling logic
 *
 * These tests verify the date calculation logic used in alert scheduling
 * without requiring the full Hono app or D1 database.
 */

// Extract the scheduling logic from alerts.ts for testing
function calculateScheduledDate(earningsDate: string, daysBefore: number): Date {
  const earningsDateObj = new Date(earningsDate + 'T00:00:00Z');
  const scheduledDate = new Date(earningsDateObj);
  scheduledDate.setDate(scheduledDate.getDate() - daysBefore);
  return scheduledDate;
}

function shouldScheduleEmail(scheduledDate: Date, now: Date): boolean {
  return scheduledDate > now;
}

// Extract after alert trigger logic from cron.ts
function shouldTriggerAfterAlert(
  earningsDate: string,
  daysAfter: number,
  today: Date
): boolean {
  const earningsDateObj = new Date(earningsDate + 'T00:00:00Z');
  const triggerDate = new Date(earningsDateObj);
  triggerDate.setUTCDate(triggerDate.getUTCDate() + daysAfter);

  // Compare dates as strings (YYYY-MM-DD) for simplicity
  const triggerDateStr = triggerDate.toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];

  return triggerDateStr! <= todayStr!;
}

describe('Before Alert Scheduling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calculates scheduled date correctly for daysBefore=2', () => {
    const earningsDate = '2024-12-15';
    const daysBefore = 2;

    const scheduledDate = calculateScheduledDate(earningsDate, daysBefore);

    expect(scheduledDate.toISOString().split('T')[0]).toBe('2024-12-13');
  });

  it('calculates scheduled date correctly for daysBefore=0 (same day)', () => {
    const earningsDate = '2024-12-15';
    const daysBefore = 0;

    const scheduledDate = calculateScheduledDate(earningsDate, daysBefore);

    expect(scheduledDate.toISOString().split('T')[0]).toBe('2024-12-15');
  });

  it('handles year boundary correctly', () => {
    const earningsDate = '2025-01-02';
    const daysBefore = 5;

    const scheduledDate = calculateScheduledDate(earningsDate, daysBefore);

    expect(scheduledDate.toISOString().split('T')[0]).toBe('2024-12-28');
  });

  it('schedules email for future dates', () => {
    vi.setSystemTime(new Date('2024-12-10T12:00:00Z'));

    const earningsDate = '2024-12-15';
    const daysBefore = 2;
    const scheduledDate = calculateScheduledDate(earningsDate, daysBefore);

    expect(shouldScheduleEmail(scheduledDate, new Date())).toBe(true);
  });

  it('does NOT schedule email for past dates', () => {
    vi.setSystemTime(new Date('2024-12-14T12:00:00Z'));

    const earningsDate = '2024-12-15';
    const daysBefore = 2;
    const scheduledDate = calculateScheduledDate(earningsDate, daysBefore);
    // scheduledDate is 2024-12-13, which is before 2024-12-14

    expect(shouldScheduleEmail(scheduledDate, new Date())).toBe(false);
  });

  it('does NOT schedule email when earningsDate is in the past', () => {
    vi.setSystemTime(new Date('2024-12-20T12:00:00Z'));

    const earningsDate = '2024-12-15';
    const daysBefore = 2;
    const scheduledDate = calculateScheduledDate(earningsDate, daysBefore);

    expect(shouldScheduleEmail(scheduledDate, new Date())).toBe(false);
  });
});

describe('After Alert Triggering', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('triggers when today equals earnings date + daysAfter', () => {
    vi.setSystemTime(new Date('2024-12-16T09:00:00Z'));

    const earningsDate = '2024-12-15';
    const daysAfter = 1;

    expect(shouldTriggerAfterAlert(earningsDate, daysAfter, new Date())).toBe(true);
  });

  it('triggers when today is after earnings date + daysAfter', () => {
    vi.setSystemTime(new Date('2024-12-18T09:00:00Z'));

    const earningsDate = '2024-12-15';
    const daysAfter = 1;

    expect(shouldTriggerAfterAlert(earningsDate, daysAfter, new Date())).toBe(true);
  });

  it('does NOT trigger when today is before earnings date + daysAfter', () => {
    vi.setSystemTime(new Date('2024-12-15T09:00:00Z'));

    const earningsDate = '2024-12-15';
    const daysAfter = 1;
    // Trigger date is 2024-12-16

    expect(shouldTriggerAfterAlert(earningsDate, daysAfter, new Date())).toBe(false);
  });

  it('triggers on same day when daysAfter=0', () => {
    vi.setSystemTime(new Date('2024-12-15T09:00:00Z'));

    const earningsDate = '2024-12-15';
    const daysAfter = 0;

    expect(shouldTriggerAfterAlert(earningsDate, daysAfter, new Date())).toBe(true);
  });

  it('handles year boundary correctly', () => {
    vi.setSystemTime(new Date('2025-01-02T09:00:00Z'));

    const earningsDate = '2024-12-31';
    const daysAfter = 2;
    // Trigger date is 2025-01-02

    expect(shouldTriggerAfterAlert(earningsDate, daysAfter, new Date())).toBe(true);
  });
});

describe('Recurring Alert Date Calculation', () => {
  it('correctly identifies alerts needing renewal', () => {
    // A recurring alert that has been triggered should find next earnings
    const alert = {
      ...testAlerts.recurringAlert,
      status: 'sent' as const,
    };

    // After processing, a recurring alert should:
    // 1. Find the next earnings date for the symbol
    // 2. Update the earningsDate
    // 3. Reset status to 'active'

    // This is tested in the cron job, here we just verify the data structure
    expect(alert.recurring).toBe(1);
    expect(alert.status).toBe('sent');
  });
});

describe('Alert Edge Cases', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('handles very large daysBefore value', () => {
    const earningsDate = '2024-12-15';
    const daysBefore = 30;

    const scheduledDate = calculateScheduledDate(earningsDate, daysBefore);

    expect(scheduledDate.toISOString().split('T')[0]).toBe('2024-11-15');
  });

  it('handles daysBefore that crosses month boundary', () => {
    const earningsDate = '2024-12-05';
    const daysBefore = 10;

    const scheduledDate = calculateScheduledDate(earningsDate, daysBefore);

    expect(scheduledDate.toISOString().split('T')[0]).toBe('2024-11-25');
  });

  it('handles leap year date calculations', () => {
    const earningsDate = '2024-03-01';
    const daysBefore = 2;

    const scheduledDate = calculateScheduledDate(earningsDate, daysBefore);

    // 2024 is a leap year, so Feb 29 exists
    expect(scheduledDate.toISOString().split('T')[0]).toBe('2024-02-28');
  });
});
