"use client";

import React, { useState } from "react";
import { Eye, Bell, TrendingUp, MoreHorizontal, Bookmark, ChevronUp, ChevronDown, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EarningsCard } from "@/components/earnings-card";
import { MobileSortDropdown } from "@/components/mobile-sort-dropdown";
import { useTableHover } from "@/hooks/use-table-hover";
import { useTableSort } from "@/hooks/use-table-sort";
import { useIsMobile } from "@/hooks/use-media-query";
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
  const isMobile = useIsMobile();
  
  const {
    hoveredRow,
    iconPosition,
    rowRefs,
    tableHeaderRef,
    handleRowHover,
    handleHoverEnd,
    handleIconAreaHover,
    handleIconAreaLeave,
    shouldShowIcons,
    ICON_VERTICAL_OFFSET,
  } = useTableHover();

  const {
    sortedData,
    sortState,
    handleSort,
    getSortIcon,
    isSortable,
  } = useTableSort(data);

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
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-left font-medium w-full"
        onClick={() => handleSort(field)}
        aria-label={`Sort by ${label}`}
        title={`Sort by ${label}`}
      >
        <span>{label}</span>
        <div className="flex flex-col items-center justify-center ml-auto w-4 h-4">
          {sortIcon === null && (
            <>
              <ChevronUp className="w-3 h-3 -mb-1 opacity-30" />
              <ChevronDown className="w-3 h-3 opacity-30" />
            </>
          )}
          {sortIcon === "asc" && <ChevronUp className="w-3 h-3 opacity-100 text-blue-600" />}
          {sortIcon === "desc" && <ChevronDown className="w-3 h-3 opacity-100 text-blue-600" />}
        </div>
      </button>
    );
  };

  // Loading state
  if (loading) {
    if (isMobile) {
      return (
        <div className={cn("relative", className)}>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
                <div className="px-4 py-3">
                  <div className="flex justify-between items-center mb-3">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    
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

  // Mobile card layout
  if (isMobile) {
    return (
      <div className={cn("relative", className)}>
        {/* Mobile Sort Dropdown */}
        <MobileSortDropdown
          sortField={sortState.field}
          sortDirection={sortState.direction}
          onSort={handleSort}
          className="mb-4"
        />
        
        {/* Mobile Cards */}
        <div className="space-y-4">
          {sortedData.map((earning) => (
            <EarningsCard
              key={`${earning.symbol}-${earning.date}`}
              earning={earning}
              isWatchlisted={watchlistedItems.has(earning.symbol)}
              onAction={onRowAction || (() => {})}
              onToggleWatchlist={onToggleWatchlist || (() => Promise.resolve(false))}
            />
          ))}
        </div>
      </div>
    );
  }

  // Desktop table layout  
  return (
    <div className={cn("relative", className)}>
      {/* Desktop table wrapper */}
      <div className="bg-card rounded-lg shadow-sm border border-border overflow-x-auto">
        <div className="min-w-[640px]">
          {/* Table Header */}
          <header 
            ref={tableHeaderRef}
            className="grid grid-cols-6 gap-4 px-6 py-3 bg-muted/50 border-b border-border text-sm sticky top-0 z-20"
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
                    "grid grid-cols-6 gap-4 px-6 py-4 transition-all duration-200 cursor-pointer relative table-row-hover border-b border-border",
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
                  <div className="flex items-center gap-2" role="cell">
                    <span className="font-medium text-sm text-foreground">{earning.symbol}</span>
                    {watchlistedItems.has(earning.symbol) && (
                      <Bookmark 
                        className="w-3 h-3 text-blue-600 dark:text-blue-400 fill-current opacity-60" 
                        aria-label="In watchlist"
                      />
                    )}
                  </div>

                  {/* Exchange */}
                  <div className="flex items-center" role="cell">
                    {earning.exchange ? (
                      <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 text-xs px-2 h-6">
                        {earning.exchange}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </div>

                  {/* Earnings Date */}
                  <div className="flex flex-col" role="cell">
                    {dateInfo ? (
                      <>
                        <span className="text-sm text-foreground">{dateInfo.formattedDate}</span>
                        <span className="text-xs text-muted-foreground">{dateInfo.relativeText}</span>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </div>

                  {/* Estimate */}
                  <div className="flex items-center text-sm text-foreground" role="cell">
                    {earning.estimate !== null && earning.estimate !== undefined
                      ? formatCurrency(earning.estimate)
                      : "-"}
                  </div>

                  {/* Actual EPS */}
                  <div className="flex items-center text-sm text-foreground" role="cell">
                    {earning.actual !== null && earning.actual !== undefined
                      ? formatCurrency(earning.actual)
                      : "-"}
                  </div>

                  {/* Surprise */}
                  <div 
                    className={cn(
                      "flex items-center text-sm",
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

      {/* Hover Bridge Area */}
      {shouldShowIcons && (
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

      {/* Action Icons Panel */}
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
          {hoveredRow && getActionIcons(hoveredRow).map((action, index) => {
            const Icon = action.icon;
            return (
              <Button
                key={index}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-accent transition-colors"
                title={action.label}
                onClick={() => action.onClick(hoveredRow)}
                aria-label={action.label}
              >
                <Icon className={cn("w-4 h-4 transition-colors", action.colorClass)} />
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
