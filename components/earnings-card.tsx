"use client";

import React, { useState } from "react";
import { Bookmark, Eye, Bell, TrendingUp, ChevronDown, ChevronUp, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercentage, formatRelativeDate, getSurpriseColorClass, cn } from "@/lib/utils";
import type { EarningsData, ActionIcon } from "@/types";

interface EarningsCardProps {
  earning: EarningsData;
  isWatchlisted: boolean;
  onAction: (action: string, symbol: string) => void;
  onToggleWatchlist: (symbol: string) => boolean | Promise<boolean>;
}

export function EarningsCard({
  earning,
  isWatchlisted,
  onAction,
  onToggleWatchlist,
}: EarningsCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
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
    <div 
      className={cn(
        "bg-card rounded-lg border border-border overflow-hidden transition-all duration-200 cursor-pointer",
        "shadow-sm active:scale-[0.98] active:shadow-lg",
        isExpanded && "shadow-md ring-2 ring-blue-500/20"
      )}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      {/* Header Row - Structured Layout */}
      <div className="px-4 py-3 relative">
        <div className="grid grid-cols-2 items-center gap-4">
          {/* Left: Ticker + Exchange */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-base text-foreground">{earning.symbol}</span>
            {earning.exchange && (
              <>
                <span className="text-muted-foreground text-sm">·</span>
                <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 text-xs px-2 h-5 flex-shrink-0">
                  {earning.exchange}
                </Badge>
              </>
            )}
            {isWatchlisted && (
              <Bookmark 
                className="w-3 h-3 text-blue-600 dark:text-blue-400 fill-current opacity-60 ml-1 flex-shrink-0" 
                aria-label="In watchlist"
              />
            )}
          </div>
          
          {/* Right: Date */}
          <div className="text-right pr-8">
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
        
        {/* Expand/Collapse Indicator - Positioned as overlay */}
        <div className="absolute top-1/2 right-4 transform -translate-y-1/2 flex items-center justify-center w-6 h-6 text-muted-foreground z-10">
          {isExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </div>
      </div>

      {/* Metrics Row - Improved 3 Column Grid */}
      <div className="px-4 py-3 border-t border-border bg-muted/5">
        <div className="grid grid-cols-3 gap-3 text-center">
          {/* Estimate */}
          <div className="min-w-0 px-1">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Estimate
            </div>
            <div className="text-sm font-semibold text-foreground truncate">
              {earning.estimate !== null && earning.estimate !== undefined
                ? formatCurrency(earning.estimate)
                : "-"}
            </div>
          </div>

          {/* Actual EPS */}
          <div className="min-w-0 px-1">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Actual EPS
            </div>
            <div className="text-sm font-semibold text-foreground truncate">
              {earning.actual !== null && earning.actual !== undefined
                ? formatCurrency(earning.actual)
                : "-"}
            </div>
          </div>

          {/* Surprise */}
          <div className="min-w-0 px-1">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Surprise
            </div>
            <div className={cn(
              "text-sm font-semibold truncate",
              getSurpriseColorClass(earning.surprisePercent)
            )}>
              {earning.surprisePercent !== null && earning.surprisePercent !== undefined
                ? formatPercentage(earning.surprisePercent, { showSign: true })
                : "-"}
            </div>
          </div>
        </div>
      </div>

      {/* Expandable Actions Section */}
      <div className={cn(
        "border-t border-border bg-muted/5 transition-all duration-300 ease-out overflow-hidden",
        isExpanded ? "max-h-48 opacity-100" : "max-h-0 opacity-0"
      )}>
        <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">Actions</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground active:text-foreground active:bg-accent"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(false);
                }}
                title="Close actions"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              {getActionIcons().map((action, index) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="h-10 flex items-center justify-start gap-2 text-xs active:bg-accent active:scale-[0.98] transition-transform min-h-[44px]"
                    onClick={(e) => {
                      e.stopPropagation();
                      action.onClick(earning.symbol);
                      setIsExpanded(false); // Close after action
                    }}
                    title={action.label}
                  >
                    <Icon className={cn("w-4 h-4", action.colorClass)} />
                    <span>{action.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>
      </div>
    </div>
  );
}