"use client";

import React from "react";
import { Eye, Bell, TrendingUp, MoreHorizontal, Bookmark, ChevronUp, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTableHover } from "@/hooks/use-table-hover";
import { useTableSort } from "@/hooks/use-table-sort";
import { formatCurrency, formatPercentage, formatRelativeDate, getSurpriseColorClass, cn } from "@/lib/utils";
import type { EarningsData, ActionIcon, TableProps } from "@/types";

export function EarningsTable({
  data,
  loading = false,
  error = null,
  onRowAction,
  watchlistedItems = new Set(),
  onToggleWatchlist,
  className,
}: TableProps) {
  const {
    hoveredRow,
    expandedRow,
    activeRow,
    iconPosition,
    rowRefs,
    tableHeaderRef,
    handleRowHover,
    handleRowTap,
    handleHoverEnd,
    handleIconAreaHover,
    handleIconAreaLeave,
    shouldShowIcons,
    isMobile,
    ICON_VERTICAL_OFFSET,
  } = useTableHover();

  const {
    sortedData,
    sortState: _sortState,
    handleSort,
    getSortIcon,
    isSortable,
  } = useTableSort(data);

  // Mobile card component for earnings data
  const MobileEarningsCard = ({ earning }: { earning: EarningsData }) => {
    const dateInfo = earning.date ? formatRelativeDate(earning.date) : null;
    const isExpanded = expandedRow === earning.symbol;
    
    return (
      <div 
        ref={(el) => {
          if (el) rowRefs.current[earning.symbol] = el;
        }}
        className={cn(
          "border border-border rounded-lg p-4 mb-3 bg-card transition-all duration-200",
          isExpanded ? "shadow-lg border-blue-200 dark:border-blue-800" : "shadow-sm"
        )}
        onClick={() => handleRowTap(earning.symbol)}
        role="button"
        tabIndex={0}
        aria-label={`${earning.symbol} earnings data - tap to expand actions`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleRowTap(earning.symbol);
          }
        }}
      >
        {/* Primary Info Row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground text-base">{earning.symbol}</span>
            {watchlistedItems.has(earning.symbol) && (
              <Bookmark className="w-3 h-3 text-blue-600 dark:text-blue-400 fill-current" />
            )}
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

        {/* Financial Data Row */}
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-xs text-muted-foreground mb-1">ESTIMATE</div>
            <div className="font-medium">
              {earning.estimate !== null && earning.estimate !== undefined
                ? formatCurrency(earning.estimate)
                : "-"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">ACTUAL EPS</div>
            <div className="font-medium">
              {earning.actual !== null && earning.actual !== undefined
                ? formatCurrency(earning.actual)
                : "-"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">SURPRISE</div>
            <div className={cn("font-medium", getSurpriseColorClass(earning.surprisePercent))}>
              {earning.surprisePercent !== null && earning.surprisePercent !== undefined
                ? formatPercentage(earning.surprisePercent, { showSign: true })
                : "-"}
            </div>
          </div>
        </div>

        {/* Expand Indicator */}
        <div className="flex justify-center mt-3">
          <div className={cn(
            "w-6 h-1 rounded-full transition-colors duration-200",
            isExpanded ? "bg-blue-500" : "bg-muted-foreground/30"
          )} />
        </div>
      </div>
    );
  };

  // Action icons configuration
  const getActionIcons = (symbol: string): ActionIcon[] => [
    {
      icon: Bookmark,
      label: "Toggle Watchlist",
      colorClass: watchlistedItems.has(symbol)
        ? "text-blue-600 dark:text-blue-400 fill-current"
        : "text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400",
      onClick: async (symbol: string) => {
        if (onToggleWatchlist) {
          await onToggleWatchlist(symbol);
        }
      },
    },
    {
      icon: Eye,
      label: "View Details",
      colorClass: "text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300",
      onClick: (symbol: string) => onRowAction?.("View Details", symbol),
    },
    {
      icon: Bell,
      label: "Set Alert",
      colorClass: "text-yellow-500 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300",
      onClick: (symbol: string) => onRowAction?.("Set Alert", symbol),
    },
    {
      icon: TrendingUp,
      label: "View Chart",
      colorClass: "text-green-500 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300",
      onClick: (symbol: string) => onRowAction?.("View Chart", symbol),
    },
    {
      icon: MoreHorizontal,
      label: "More Actions",
      colorClass: "text-muted-foreground hover:text-foreground",
      onClick: (symbol: string) => onRowAction?.("More Actions", symbol),
    },
  ];

  // Render table header cell with sorting
  const renderHeaderCell = (field: keyof EarningsData, label: string) => {
    const sortIcon = getSortIcon(field);
    const isClickable = isSortable(field);
    
    if (!isClickable) {
      return (
        <div role="columnheader" className="text-muted-foreground font-medium">
          {label}
        </div>
      );
    }

    return (
      <button
        role="columnheader" 
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-left font-medium"
        onClick={() => handleSort(field)}
        aria-label={`Sort by ${label}`}
        title={`Sort by ${label}`}
      >
        <span>{label}</span>
        <div className="w-4 h-4 flex flex-col items-center justify-center">
          {sortIcon === null && (
            <>
              <ChevronUp className="w-3 h-3 -mb-1 opacity-30" />
              <ChevronDown className="w-3 h-3 opacity-30" />
            </>
          )}
          {sortIcon === "asc" && <ChevronUp className="w-3 h-3 opacity-100" />}
          {sortIcon === "desc" && <ChevronDown className="w-3 h-3 opacity-100" />}
        </div>
      </button>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className={cn("relative", className)}>
        <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
          {/* Header skeleton */}
          <div className="grid grid-cols-6 gap-4 px-6 py-3 bg-muted/50 border-b border-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-16" />
            ))}
          </div>
          
          {/* Rows skeleton */}
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="grid grid-cols-6 gap-4 px-6 py-4">
                {Array.from({ length: 6 }).map((_, j) => (
                  <Skeleton key={j} className="h-4 w-full" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn("relative", className)}>
        <Alert variant="destructive">
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Empty state
  if (!data || data.length === 0) {
    return (
      <div className={cn("relative", className)}>
        <div className="bg-card rounded-lg shadow-sm border border-border p-12 text-center">
          <p className="text-muted-foreground">No earnings data found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {isMobile ? (
        // Mobile Card Layout
        <div className="space-y-0">
          {sortedData.map((earning) => (
            <MobileEarningsCard key={`${earning.symbol}-${earning.date}`} earning={earning} />
          ))}
        </div>
      ) : (
        // Desktop Table Layout
        <div className="bg-card rounded-lg shadow-sm border border-border overflow-x-auto">
          <div className="min-w-[640px]">
          {/* Table Header */}
          <header 
            ref={tableHeaderRef}
            className="grid grid-cols-6 gap-2 sm:gap-4 px-3 sm:px-6 py-2 sm:py-3 bg-muted/50 border-b border-border text-xs sm:text-sm sticky top-0 z-20"
            role="row"
          >
          {renderHeaderCell("symbol", "TICKER")}
          {renderHeaderCell("exchange", "EXCHANGE")}
          {renderHeaderCell("date", "EARNINGS DATE")}
          {renderHeaderCell("estimate", "ESTIMATE")}
          {renderHeaderCell("actual", "EPS")}
          {renderHeaderCell("surprisePercent", "SURPRISE")}
        </header>

          {/* Table Body */}
          <div role="table">
            {sortedData.map((earning) => {
              const dateInfo = earning.date ? formatRelativeDate(earning.date) : null;
              
              return (
                <div
                  key={`${earning.symbol}-${earning.date}`}
                  ref={(el) => {
                    if (el) rowRefs.current[earning.symbol] = el;
                  }}
                  className={cn(
                    "grid grid-cols-6 gap-2 sm:gap-4 px-3 sm:px-6 py-3 sm:py-4 transition-all duration-200 cursor-pointer relative table-row-hover border-b border-border",
                  hoveredRow === earning.symbol
                    ? "bg-blue-50 dark:bg-blue-950/50 shadow-md transform translate-x-1"
                    : "hover:bg-accent/50"
                )}
                onMouseEnter={() => handleRowHover(earning.symbol)}
                onMouseLeave={handleHoverEnd}
                role="row"
                tabIndex={0}
                aria-label={`${earning.symbol} earnings data`}
              >
                  {/* Ticker */}
                  <div className="flex items-center gap-1 sm:gap-2" role="cell">
                    <span className="font-medium text-xs sm:text-sm text-foreground">{earning.symbol}</span>
                    {watchlistedItems.has(earning.symbol) && (
                      <Bookmark 
                        className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-blue-600 dark:text-blue-400 fill-current opacity-60" 
                        aria-label="In watchlist"
                      />
                    )}
                  </div>

                  {/* Exchange */}
                  <div className="flex items-center" role="cell">
                    {earning.exchange ? (
                      <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 text-[10px] sm:text-xs px-1 sm:px-2 h-5 sm:h-6">
                        {earning.exchange}
                      </Badge>
                    ) : (
                      <span className="text-xs sm:text-sm text-muted-foreground">-</span>
                    )}
                  </div>

                  {/* Earnings Date */}
                  <div className="flex flex-col" role="cell">
                    {dateInfo ? (
                      <>
                        <span className="text-xs sm:text-sm text-foreground">{dateInfo.formattedDate}</span>
                        <span className="text-[10px] sm:text-xs text-muted-foreground">{dateInfo.relativeText}</span>
                      </>
                    ) : (
                      <span className="text-xs sm:text-sm text-muted-foreground">-</span>
                    )}
                  </div>

                  {/* Estimate */}
                  <div className="flex items-center text-xs sm:text-sm text-foreground" role="cell">
                    {earning.estimate !== null && earning.estimate !== undefined
                      ? formatCurrency(earning.estimate)
                      : "-"}
                  </div>

                  {/* Actual EPS */}
                  <div className="flex items-center text-xs sm:text-sm text-foreground" role="cell">
                    {earning.actual !== null && earning.actual !== undefined
                      ? formatCurrency(earning.actual)
                      : "-"}
                  </div>

                  {/* Surprise */}
                  <div 
                    className={cn(
                      "flex items-center text-xs sm:text-sm",
                      getSurpriseColorClass(earning.surprisePercent)
                    )} 
                    role="cell"
                  >
                    {earning.surprisePercent !== null && earning.surprisePercent !== undefined
                      ? formatPercentage(earning.surprisePercent, { showSign: true })
                      : "-"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        </div>
      )}

      {/* Desktop Hover Bridge Area */}
      {!isMobile && shouldShowIcons && (
        <div 
          className="absolute pointer-events-auto border-0 bg-transparent"
          style={{ 
            left: "100%",
            top: `${iconPosition - ICON_VERTICAL_OFFSET}px`,
            width: "80px",
            height: "60px",
            zIndex: 1,
          }}
          onMouseEnter={handleIconAreaHover}
          onMouseLeave={handleIconAreaLeave}
          aria-hidden="true"
        />
      )}

      {/* Desktop Action Icons Panel */}
      {!isMobile && (
        <div 
          className={cn(
            "absolute flex items-center transition-all duration-300 ease-out z-10",
            shouldShowIcons 
              ? "opacity-100 translate-x-0 pointer-events-auto action-panel-enter-active" 
              : "opacity-0 translate-x-4 pointer-events-none action-panel-enter"
          )}
          style={{ 
            left: "100%",
            marginLeft: "1rem",
            top: `${iconPosition}px`,
            transform: "translateY(-50%)",
          }}
          onMouseEnter={handleIconAreaHover}
          onMouseLeave={handleIconAreaLeave}
          role="toolbar"
          aria-label="Stock actions"
        >
          <div className="bg-card rounded-lg shadow-lg border border-border p-2 flex flex-col gap-2">
            {activeRow && getActionIcons(activeRow).map((action, index) => {
              const Icon = action.icon;
              return (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-accent transition-colors"
                  title={action.label}
                  onClick={() => action.onClick(activeRow)}
                  aria-label={action.label}
                >
                  <Icon className={cn("w-4 h-4 transition-colors", action.colorClass)} />
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* Mobile Action Panel */}
      {isMobile && shouldShowIcons && activeRow && (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 shadow-lg z-50">
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium text-foreground">{activeRow} Actions</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRowTap(activeRow)}
              aria-label="Close actions"
            >
              ✕
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {getActionIcons(activeRow).slice(0, 4).map((action, index) => {
              const Icon = action.icon;
              return (
                <Button
                  key={index}
                  variant="outline"
                  className="h-12 flex flex-col gap-1 text-xs"
                  onClick={() => {
                    action.onClick(activeRow);
                    handleRowTap(activeRow); // Close after action
                  }}
                  aria-label={action.label}
                >
                  <Icon className={cn("w-4 h-4", action.colorClass)} />
                  <span>{action.label}</span>
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
