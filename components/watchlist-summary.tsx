"use client";

import { useMemo } from "react";
import { BarChart3, Bell, Calendar, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EarningsData } from "@/types";
import type { KVAlert } from "@/lib/auth";

interface WatchlistSummaryProps {
  watchlistCount: number;
  earnings: EarningsData[];
  alerts: KVAlert[];
  onBulkAlertClick?: () => void;
  className?: string;
}

export function WatchlistSummary({
  watchlistCount,
  earnings,
  alerts,
  onBulkAlertClick,
  className,
}: WatchlistSummaryProps) {
  // Calculate stats
  const stats = useMemo(() => {
    // Get unique symbols with active alerts
    const alertedSymbols = new Set(
      alerts
        .filter((a) => a.status === "active")
        .map((a) => a.symbol.toUpperCase())
    );

    // Get symbols in earnings data
    const earningsSymbols = new Set(earnings.map((e) => e.symbol.toUpperCase()));

    // Count stocks with alerts
    const withAlerts = Array.from(earningsSymbols).filter((s) =>
      alertedSymbols.has(s)
    ).length;

    // Count stocks without alerts
    const withoutAlerts = earningsSymbols.size - withAlerts;

    // Count earnings this week
    const now = new Date();
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const earningsThisWeek = earnings.filter((e) => {
      if (!e.date) return false;
      const earningsDate = new Date(e.date);
      return earningsDate >= now && earningsDate <= oneWeekFromNow;
    }).length;

    return {
      total: watchlistCount,
      withAlerts,
      withoutAlerts,
      earningsThisWeek,
    };
  }, [watchlistCount, earnings, alerts]);

  return (
    <div
      className={cn(
        "bg-card border border-border rounded-lg p-4 mb-4",
        className
      )}
    >
      {/* Stats Row */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">{stats.total}</span>
          <span className="text-muted-foreground">stocks</span>
        </div>

        <span className="text-muted-foreground">•</span>

        <div className="flex items-center gap-1.5">
          <Bell className="w-4 h-4 text-yellow-500" />
          <span className="font-medium">{stats.withAlerts}</span>
          <span className="text-muted-foreground">with alerts</span>
        </div>

        <span className="text-muted-foreground">•</span>

        <div className="flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-blue-500" />
          <span className="font-medium">{stats.earningsThisWeek}</span>
          <span className="text-muted-foreground">earnings this week</span>
        </div>
      </div>

      {/* Bulk Action */}
      {stats.withoutAlerts > 0 && onBulkAlertClick && (
        <div className="mt-3 pt-3 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={onBulkAlertClick}
            className="h-8 text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add alerts to {stats.withoutAlerts} stock{stats.withoutAlerts > 1 ? "s" : ""} without
          </Button>
        </div>
      )}
    </div>
  );
}
