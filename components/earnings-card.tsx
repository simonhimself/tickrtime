"use client";

import React from "react";
import { Bookmark, Eye, Bell, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercentage, formatRelativeDate, getSurpriseColorClass, cn } from "@/lib/utils";
import type { EarningsData, ActionIcon } from "@/types";

interface EarningsCardProps {
  earning: EarningsData;
  isWatchlisted: boolean;
  onAction: (action: string, symbol: string) => void;
  onToggleWatchlist: (symbol: string) => Promise<boolean>;
}

export function EarningsCard({
  earning,
  isWatchlisted,
  onAction,
  onToggleWatchlist,
}: EarningsCardProps) {
  const dateInfo = earning.date ? formatRelativeDate(earning.date) : null;

  // Action icons configuration
  const getActionIcons = (): ActionIcon[] => [
    {
      icon: Bookmark,
      label: "Watchlist",
      colorClass: isWatchlisted
        ? "text-blue-600 dark:text-blue-400 fill-current"
        : "text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400",
      onClick: async () => {
        await onToggleWatchlist(earning.symbol);
      },
    },
    {
      icon: Eye,
      label: "Details",
      colorClass: "text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300",
      onClick: () => onAction("View Details", earning.symbol),
    },
    {
      icon: Bell,
      label: "Alert",
      colorClass: "text-yellow-500 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300",
      onClick: () => onAction("Set Alert", earning.symbol),
    },
    {
      icon: TrendingUp,
      label: "Chart",
      colorClass: "text-green-500 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300",
      onClick: () => onAction("View Chart", earning.symbol),
    },
  ];

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden transition-all duration-200 hover:shadow-md active:scale-[0.98]">
      {/* Header Row - Ticker, Exchange, Date */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-base text-foreground">{earning.symbol}</span>
          {isWatchlisted && (
            <Bookmark 
              className="w-3 h-3 text-blue-600 dark:text-blue-400 fill-current opacity-60" 
              aria-label="In watchlist"
            />
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {earning.exchange && (
            <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 text-xs px-2 h-5">
              {earning.exchange}
            </Badge>
          )}
        </div>
        
        <div className="text-right">
          {dateInfo ? (
            <>
              <div className="text-sm font-medium text-foreground">{dateInfo.formattedDate}</div>
              <div className="text-xs text-muted-foreground">{dateInfo.relativeText}</div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">-</div>
          )}
        </div>
      </div>

      {/* Metrics Row - 3 Column Grid */}
      <div className="px-4 py-3 border-t border-border bg-muted/5">
        <div className="grid grid-cols-3 gap-4 text-center">
          {/* Estimate */}
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Estimate
            </div>
            <div className="text-sm font-semibold text-foreground">
              {earning.estimate !== null && earning.estimate !== undefined
                ? formatCurrency(earning.estimate)
                : "-"}
            </div>
          </div>

          {/* Actual EPS */}
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Actual EPS
            </div>
            <div className="text-sm font-semibold text-foreground">
              {earning.actual !== null && earning.actual !== undefined
                ? formatCurrency(earning.actual)
                : "-"}
            </div>
          </div>

          {/* Surprise */}
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Surprise
            </div>
            <div className={cn(
              "text-sm font-semibold",
              getSurpriseColorClass(earning.surprisePercent)
            )}>
              {earning.surprisePercent !== null && earning.surprisePercent !== undefined
                ? formatPercentage(earning.surprisePercent, { showSign: true })
                : "-"}
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="px-4 py-3 bg-muted/10 border-t border-border">
        <div className="flex items-center justify-center gap-3">
          {getActionIcons().map((action, index) => {
            const Icon = action.icon;
            return (
              <Button
                key={index}
                variant="ghost"
                size="sm"
                className="h-9 px-3 flex items-center gap-2 text-xs hover:bg-accent transition-colors min-w-[44px]"
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick(earning.symbol);
                }}
                title={action.label}
              >
                <Icon className={cn("w-4 h-4", action.colorClass)} />
                <span className="hidden sm:inline">{action.label}</span>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}