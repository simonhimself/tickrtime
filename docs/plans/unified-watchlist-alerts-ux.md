# Feature Spec: Unified Watchlist & Alerts UX

> **Status**: Draft
> **Author**: Claude + Simon
> **Created**: 2025-12-27
> **Target Location**: `docs/specs/001-unified-watchlist-alerts.md`

---

## Overview

Improve the UX relationship between Watchlist and Alerts features by treating **Alerts as a subset of Watchlist**. Users should not be able to create alerts for stocks they aren't watching, and alert management should happen within the watchlist view—not buried in the profile page.

## Problem Statement

Current issues with the watchlist/alerts UX:

1. **Disconnected features**: Alerts and watchlist are completely independent—users can alert on stocks they don't watch
2. **Scattered management**: Alerts are managed in the profile page, far from where users interact with their stocks
3. **No visibility**: Watchlist view shows no indication of which stocks have alerts configured
4. **Missing stocks**: Watchlisted stocks without upcoming earnings data don't appear in watchlist view

## Goals

- [ ] Enforce alerts as a subset of watchlist (can't alert without watching)
- [ ] Move alert management into the watchlist view
- [ ] Add inline alert configuration (no modal hunting)
- [ ] Show all watchlisted stocks, even without earnings dates
- [ ] Provide bulk alert management for watchlist

## Non-Goals

- Changing the underlying data models (alerts in D1, watchlist in KV)
- Adding new notification types (push, SMS, etc.)
- Real-time price tracking or portfolio features

---

## Detailed Design

### 1. Bell Icon Behavior Change (Main Earnings Table)

**Current**: Bell icon opens alert dialog regardless of watchlist status

**New**: Bell icon auto-adds to watchlist if needed, then opens alert config

| User Action | Current Behavior | New Behavior |
|-------------|------------------|--------------|
| Click bell on non-watchlisted stock | Opens alert dialog | 1. Auto-add to watchlist<br>2. Show toast: "Added {SYMBOL} to watchlist"<br>3. Open alert config popover |
| Click bell on watchlisted stock (no alert) | Opens alert dialog | Open alert config popover |
| Click bell on watchlisted stock (has alert) | Opens alert dialog | Open alert edit popover |

**Files to modify:**
- `components/earnings-table.tsx` - Desktop row action handler
- `components/earnings-card.tsx` - Mobile card action handler
- `hooks/use-alerts.ts` - Add `createAlertWithWatchlist()` function

### 2. New Alert Column in Watchlist View (Desktop)

Add an **ALERT** column to the earnings table when in watchlist mode.

**Column specification:**
- **Header**: "ALERT" (sortable by: has alert → alert date)
- **Position**: After "EARNINGS DATE", before "ESTIMATE"
- **Width**: ~140px

**Cell states:**

| State | Display | Styling |
|-------|---------|---------|
| No alert | "Add alert" | Muted text, outlined bell icon |
| Alert before | "🔔 {N}d before" | Normal text, filled bell |
| Alert after | "🔔 {N}d after" | Normal text, filled bell |
| Both alerts | "🔔 {N}d before +1" | Normal text, filled bell |
| Recurring | Add 🔁 icon | Small repeat icon |

**On click**: Opens inline popover (not modal) for configuration

**Files to modify:**
- `components/earnings-table.tsx` - Add conditional ALERT column
- `types/index.ts` - Extend `EarningsData` display type if needed

### 3. Alert Config Popover Component

**New component**: `components/alert-config-popover.tsx`

```
┌─────────────────────────────────────┐
│ Alert for AAPL                   ✕  │
│ Earnings: Jan 30, 2025              │
├─────────────────────────────────────┤
│                                     │
│ ☑ Before earnings  [ 2 ] days      │
│ ☐ After earnings   [ 1 ] days      │
│                                     │
│ ☐ Recurring (auto-alert next time) │
│                                     │
├─────────────────────────────────────┤
│ [Remove Alert]           [Save]     │
└─────────────────────────────────────┘
```

**Behavior:**
- Checkbox to enable before/after (can enable both)
- Number input for days (0-30 range, validated)
- Recurring toggle
- Remove button (only shown if alert exists)
- Save creates/updates alert via API
- Dismisses on outside click or save

**Files to create:**
- `components/alert-config-popover.tsx`

**Dependencies:**
- Radix UI Popover (already in project)
- Existing alert API client functions

### 4. Mobile Card Alert Enhancement

**Changes to `earnings-card.tsx`:**

1. **Header indicator**: Show 🔔 icon next to ticker if alert exists
2. **Expanded section**: Replace alert button with inline config

```
┌─ Card Header ─────────────────────────────────┐
│ AAPL 🔔        NASDAQ           Jan 30 · 3d  │
│ Apple Inc                                     │
├─ Metrics ─────────────────────────────────────┤
│  Estimate       Actual         Surprise       │
│   $2.35           -               -           │
├─ Actions (expanded) ──────────────────────────┤
│ [📑 Remove] [👁 View] [📈 Chart]              │
│                                               │
│ ┌─ Alert Settings ──────────────────────────┐ │
│ │ ☑ Before [ 2 ] days                       │ │
│ │ ☐ After  [ 1 ] days                       │ │
│ │ ☐ Recurring              [Save]           │ │
│ └───────────────────────────────────────────┘ │
└───────────────────────────────────────────────┘
```

**Files to modify:**
- `components/earnings-card.tsx`

### 5. Watchlist Summary Bar

**New component**: `components/watchlist-summary.tsx`

Displayed only in watchlist mode, below the page description:

```
┌─────────────────────────────────────────────────────────────────┐
│ 📊 12 stocks  •  🔔 8 with alerts  •  📅 3 earnings this week  │
│                                                                 │
│ [+ Add alerts to all without]                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Stats calculation:**
- Total stocks: `watchlist.count`
- With alerts: Cross-reference with `alerts` where status = 'active'
- Earnings this week: Filter by date range

**Bulk action button:**
- Only shown if some watchlisted stocks don't have alerts
- Opens bulk alert dialog (see below)

**Files to create:**
- `components/watchlist-summary.tsx`

**Files to modify:**
- `components/earnings-dashboard.tsx` - Render summary bar in watchlist mode

### 6. Bulk Alert Dialog

**New component**: `components/bulk-alert-dialog.tsx`

```
┌─────────────────────────────────────────────────┐
│ Add Alerts to 4 Stocks                       ✕  │
├─────────────────────────────────────────────────┤
│                                                 │
│ Alert me [ 2 ] days before earnings            │
│                                                 │
│ ☐ Also alert [ 1 ] days after earnings         │
│                                                 │
│ ☑ Make recurring (alert for future earnings)   │
│                                                 │
├─────────────────────────────────────────────────┤
│ Applies to: GOOGL, META, AMD, INTC             │
├─────────────────────────────────────────────────┤
│                    [Cancel]  [Add 4 Alerts]     │
└─────────────────────────────────────────────────┘
```

**Files to create:**
- `components/bulk-alert-dialog.tsx`

**API consideration:**
- May need batch endpoint: `POST /api/alerts/bulk`
- Or call existing endpoint in sequence (acceptable for <20 items)

### 7. Show Watchlisted Stocks Without Earnings

**Problem**: Current implementation only shows stocks with upcoming earnings data from Finnhub.

**Solution**: Merge watchlist symbols with earnings data, showing placeholders for missing.

**Changes to `loadWatchlistEarnings()` in `earnings-dashboard.tsx`:**

```typescript
// Pseudocode for merged approach
const watchedSymbols = watchlist.getWatchedSymbols();
const earningsData = await getEarningsWatchlist(watchedSymbols);

// Find symbols without earnings data
const symbolsWithEarnings = new Set(earningsData.map(e => e.symbol));
const symbolsWithoutEarnings = watchedSymbols.filter(s => !symbolsWithEarnings.has(s));

// Create placeholder entries
const placeholders = symbolsWithoutEarnings.map(symbol => ({
  symbol,
  date: null,
  actual: null,
  estimate: null,
  // ... other fields null
  _noEarningsData: true, // Flag for UI handling
}));

// Merge and sort (earnings first, then placeholders)
setEarnings([...earningsData, ...placeholders]);
```

**UI handling:**
- Show "No date yet" in EARNINGS DATE column
- Alert column: "🔔 When available" or allow setting recurring alert
- Muted row styling to indicate incomplete data

### 8. Profile Page Cleanup

**Remove from profile page:**
- AlertsManager component
- Alert list display

**Keep on profile page:**
- Notification preferences (email enabled, default days before/after)
- Account settings

**Files to modify:**
- `app/profile/page.tsx` - Remove AlertsManager section

---

## Implementation Plan

### Phase 1: Core Alert-Watchlist Integration
1. Modify bell icon behavior (auto-add to watchlist)
2. Create `alert-config-popover.tsx` component
3. Wire up popover to existing alert API

### Phase 2: Watchlist View Enhancement
4. Add ALERT column to desktop table (watchlist mode only)
5. Add alert indicator + inline config to mobile cards
6. Create `watchlist-summary.tsx` component

### Phase 3: Edge Cases & Polish
7. Handle stocks without earnings data
8. Create bulk alert dialog
9. Remove alert management from profile page
10. Add loading/error states for new components

### Phase 4: Testing & Refinement
11. Test all user flows end-to-end
12. Mobile responsiveness testing
13. Error handling and edge cases

---

## Files Summary

### New Files
| File | Purpose |
|------|---------|
| `components/alert-config-popover.tsx` | Inline alert configuration popover |
| `components/watchlist-summary.tsx` | Stats bar for watchlist view |
| `components/bulk-alert-dialog.tsx` | Bulk alert creation dialog |
| `docs/specs/001-unified-watchlist-alerts.md` | This spec (final location) |

### Modified Files
| File | Changes |
|------|---------|
| `components/earnings-table.tsx` | Add ALERT column, modify bell click handler |
| `components/earnings-card.tsx` | Add alert indicator, inline config in expanded section |
| `components/earnings-dashboard.tsx` | Add watchlist summary, handle stocks without earnings |
| `hooks/use-alerts.ts` | Add helper for create-with-watchlist flow |
| `app/profile/page.tsx` | Remove AlertsManager section |
| `CLAUDE.md` | Add docs/specs folder reference |

---

## Resolved Questions

1. **Batch API**: Start with sequential calls to existing endpoint. Optimize with `/api/alerts/bulk` later if needed.
2. **Recurring without date**: Yes - users can set recurring alerts for stocks without known earnings dates. Alert triggers when date becomes available.
3. **Alert column visibility**: Watchlist mode only - keeps other views (today, tomorrow, next 30) clean and focused.

---

## Success Criteria

- [ ] Users cannot create alerts for non-watchlisted stocks
- [ ] Bell icon on non-watchlisted stock adds to watchlist + opens alert config
- [ ] Watchlist view shows alert status for each stock
- [ ] Alerts can be configured inline (popover) without navigating away
- [ ] All watchlisted stocks visible, even without earnings dates
- [ ] Bulk "add alerts to all" functionality works
- [ ] Alert management removed from profile page
- [ ] Mobile experience is equivalent to desktop

---

## Post-Implementation

Once this feature is complete:
1. Move spec to `docs/specs/001-unified-watchlist-alerts.md`
2. Update `CLAUDE.md` to reference the specs folder
3. Consider follow-up improvements:
   - Alert history/log view
   - "Suggested alerts" based on watchlist
   - Notification preferences per-stock
