# Plan: Confirmation Dialog for Watchlist-Alert Cascade

## Summary
When a user removes a ticker from their watchlist that has active alerts, show a confirmation dialog before deleting both the watchlist entry and the associated alerts.

## Context
- Alerts are a "subset" of watchlist - setting an alert auto-adds to watchlist
- Alerts are only manageable in watchlist view
- **Problem**: If a user removes from watchlist, alerts become orphaned (no UI to manage them)
- **Solution**: Show confirmation dialog, then delete alerts when removing from watchlist

## Already Completed
1. `deleteAlertsBySymbol` function in `packages/api/src/lib/db/alerts.ts` (lines 252-291)
2. DELETE `/api/alerts/symbol/:symbol` route in `packages/api/src/routes/alerts.ts`
3. `deleteAlertsBySymbol` in `lib/api-client.ts` (lines 156-160)

## Implementation Steps

### Step 1: Add getAlertsForSymbol to useAlerts hook
**File**: `hooks/use-alerts.ts`

Add a function to get the count of alerts for a specific symbol:
```typescript
const getAlertsForSymbol = useCallback((symbol: string) => {
  const normalizedSymbol = symbol.toUpperCase();
  return alerts.filter(
    a => a.symbol.toUpperCase() === normalizedSymbol && a.status === 'active'
  );
}, [alerts]);
```

Export it in the return object.

### Step 2: Update handleWatchlistToggle in EarningsDashboard
**File**: `components/earnings-dashboard.tsx`

Add state for the confirmation dialog:
```typescript
const [removeConfirm, setRemoveConfirm] = useState<{
  symbol: string;
  alertCount: number;
} | null>(null);
```

Modify `handleWatchlistToggle` (line 288):
- If removing (was in watchlist) AND has alerts -> show confirmation dialog
- If adding OR no alerts -> proceed normally

### Step 3: Add AlertDialog to EarningsDashboard JSX
**File**: `components/earnings-dashboard.tsx`

Add imports:
```typescript
import { deleteAlertsBySymbol } from "@/lib/api-client";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogCancel, AlertDialogAction
} from "@/components/ui/alert-dialog";
```

Add dialog component in the JSX return.

### Step 4: Add handleConfirmRemove function
**File**: `components/earnings-dashboard.tsx`

Function to execute when user confirms removal:
1. Delete alerts first via API
2. Remove from watchlist
3. Show toast confirmation
4. Trigger alerts refresh event

## Files to Modify

| File | Changes |
|------|---------|
| `hooks/use-alerts.ts` | Add `getAlertsForSymbol` function |
| `components/earnings-dashboard.tsx` | Add dialog state, modify toggle, add AlertDialog JSX |

## Testing
1. Add ticker to watchlist
2. Create alert for that ticker
3. Try to remove ticker from watchlist
4. Verify confirmation dialog appears with correct alert count
5. Confirm removal and verify both watchlist entry and alerts are deleted
