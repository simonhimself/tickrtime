# Fix: Alert Dialog Shows Past Earnings Date

## Problem

When viewing **"Previous 30 days"** (historical earnings) and clicking the alert icon, the dialog shows the past earnings date instead of the next upcoming earnings date for that stock.

**Example:** User views CGNT's December 9, 2025 earnings in "Previous 30 days" → Opens alert dialog → Dialog shows "Earnings: Dec 9, 2025" (the past date) instead of fetching CGNT's next upcoming earnings date.

## Root Cause Analysis

**Data flow:**
1. `EarningsTable` passes the clicked row's `earning` object (with past date) to `onAlertClick`
2. `EarningsDashboard` stores this as `alertEarningsData` and passes to `AlertConfigPopover`
3. `AlertConfigPopover` sets `earningsDate` state from `earningsData?.date` (the past date)
4. The fallback fetch (`fetchEarningsDate`) only runs if `!earningsDate` — but since a date was passed, it never triggers

**The bug:** The fallback mechanism assumes no date means "fetch one", but doesn't account for dates being in the past.

## Solution

**Approach:** Detect if the passed earnings date is in the past, and if so, fetch the next upcoming earnings date.

### File: `components/alert-config-popover.tsx`

**Change the effect that sets `earningsDate` (around line 101):**

Current logic:
```typescript
setEarningsDate(earningsData?.date || newBeforeAlert?.earningsDate || newAfterAlert?.earningsDate || "");
```

New logic:
```typescript
// Check if the passed date is in the past
const passedDate = earningsData?.date;
const isPastDate = passedDate && new Date(passedDate) < new Date(new Date().toDateString());

if (isPastDate) {
  // Past date - clear it so fetchEarningsDate runs
  setEarningsDate("");
} else {
  // Future date or existing alert date - use it
  setEarningsDate(passedDate || newBeforeAlert?.earningsDate || newAfterAlert?.earningsDate || "");
}
```

This triggers the existing `fetchEarningsDate` fallback which calls `getEarningsWatchlist([symbol])` to get the **next upcoming** earnings date.

## Files to Modify

| File | Changes |
|------|---------|
| `components/alert-config-popover.tsx` | Add past-date detection logic in the form reset effect |

## Expected Behavior After Fix

| View Mode | Behavior |
|-----------|----------|
| Today | Uses passed date (future) ✓ |
| Tomorrow | Uses passed date (future) ✓ |
| Next 30 Days | Uses passed date (future) ✓ |
| **Previous 30 Days** | Detects past date → fetches upcoming earnings ✓ |
| Watchlist | Uses passed date (future) ✓ |
| Search (historical) | Detects past date → fetches upcoming earnings ✓ |

## Testing

1. Navigate to "Previous 30 Days"
2. Click alert icon on any stock with a past earnings date
3. Verify dialog shows "Earnings: [future date]" (not the past date)
4. Save the alert
5. Verify the alert is created for the upcoming earnings, not the past one
