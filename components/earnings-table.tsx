"use client";

import React, { useState } from "react";
import { Eye, Bell, TrendingUp, MoreHorizontal, Bookmark, ChevronUp, ChevronDown, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  
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

  // Handle row expansion on mobile
  const handleRowToggle = (symbol: string) => {
    if (!isMobile) return;
    
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(symbol)) {
      newExpanded.delete(symbol);
    } else {
      newExpanded.add(symbol);
    }
    setExpandedRows(newExpanded);
  };

  const {
    sortedData,
    sortState: _sortState,
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

  // Render table header cell with sorting (mobile-optimized)
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
        className={cn(
          "flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-left font-medium w-full",
          isMobile ? "py-2 min-h-[44px] active:bg-accent rounded-md" : ""
        )}
        onClick={() => handleSort(field)}
        aria-label={`Sort by ${label}`}
        title={`Sort by ${label}`}
      >
        <span className={cn(isMobile && "text-xs")}>{label}</span>
        <div className={cn(
          "flex flex-col items-center justify-center ml-auto",
          isMobile ? "w-5 h-5" : "w-4 h-4"
        )}>
          {sortIcon === null && (
            <>
              <ChevronUp className={cn(isMobile ? "w-3 h-3" : "w-3 h-3", "-mb-1 opacity-30")} />
              <ChevronDown className={cn(isMobile ? "w-3 h-3" : "w-3 h-3", "opacity-30")} />
            </>
          )}
          {sortIcon === "asc" && <ChevronUp className={cn(isMobile ? "w-4 h-4" : "w-3 h-3", "opacity-100 text-blue-600")} />}
          {sortIcon === "desc" && <ChevronDown className={cn(isMobile ? "w-4 h-4" : "w-3 h-3", "opacity-100 text-blue-600")} />}
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
      {/* Responsive table wrapper */}
      <div className="bg-card rounded-lg shadow-sm border border-border overflow-x-auto">
        <div className={cn(isMobile ? "min-w-full" : "min-w-[640px]")}>
          {/* Table Header */}
          <header 
            ref={tableHeaderRef}
            className={cn(
              "gap-2 sm:gap-4 px-3 sm:px-6 py-2 sm:py-3 bg-muted/50 border-b border-border text-xs sm:text-sm sticky top-0 z-20",
              isMobile ? "grid grid-cols-4" : "grid grid-cols-6"
            )}
            role="row"
          >
          {renderHeaderCell("symbol", "TICKER")}
          {!isMobile && renderHeaderCell("exchange", "EXCHANGE")}
          {renderHeaderCell("date", "EARNINGS DATE")}
          {!isMobile && renderHeaderCell("estimate", "ESTIMATE")}
          {renderHeaderCell("actual", "EPS")}
          {renderHeaderCell("surprisePercent", "SURPRISE")}
        </header>

          {/* Table Body */}
          <div role="table">
            {sortedData.map((earning) => {
              const dateInfo = earning.date ? formatRelativeDate(earning.date) : null;
              const isExpanded = expandedRows.has(earning.symbol);
              
              return (
                <React.Fragment key={`${earning.symbol}-${earning.date}`}>
                  <div
                    ref={(el) => {
                      if (el) rowRefs.current[earning.symbol] = el;
                    }}
                    className={cn(
                      "gap-2 sm:gap-4 px-3 sm:px-6 py-3 sm:py-4 transition-all duration-200 cursor-pointer relative table-row-hover border-b border-border",
                      isMobile ? "grid grid-cols-4" : "grid grid-cols-6",
                      hoveredRow === earning.symbol
                        ? "bg-blue-50 dark:bg-blue-950/50 shadow-md transform translate-x-1"
                        : "hover:bg-accent/50",
                      isMobile && isExpanded && "bg-accent/30"
                    )}
                    onMouseEnter={() => handleRowHover(earning.symbol)}
                    onMouseLeave={handleHoverEnd}
                    onClick={() => handleRowToggle(earning.symbol)}
                    role="row"
                    tabIndex={0}
                    aria-label={`${earning.symbol} earnings data ${isMobile ? '- tap to expand' : ''}`}
                    aria-expanded={isMobile ? isExpanded : undefined}
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
                      {isMobile && (
                        <ChevronRight className={cn(
                          "w-4 h-4 ml-auto transition-transform duration-200 text-muted-foreground",
                          isExpanded && "rotate-90"
                        )} />
                      )}
                    </div>

                    {/* Exchange - Desktop only */}
                    {!isMobile && (
                      <div className="flex items-center" role="cell">
                        {earning.exchange ? (
                          <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 text-[10px] sm:text-xs px-1 sm:px-2 h-5 sm:h-6">
                            {earning.exchange}
                          </Badge>
                        ) : (
                          <span className="text-xs sm:text-sm text-muted-foreground">-</span>
                        )}
                      </div>
                    )}

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

                    {/* Estimate - Desktop only */}
                    {!isMobile && (
                      <div className="flex items-center text-xs sm:text-sm text-foreground" role="cell">
                        {earning.estimate !== null && earning.estimate !== undefined
                          ? formatCurrency(earning.estimate)
                          : "-"}
                      </div>
                    )}

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

                  {/* Mobile Expanded Details */}
                  {isMobile && isExpanded && (
                    <div className="px-3 sm:px-6 pb-4 border-b border-border bg-accent/10">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {/* Exchange */}
                        <div>
                          <div className="text-xs text-muted-foreground mb-1 font-medium">EXCHANGE</div>
                          {earning.exchange ? (
                            <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 text-xs px-2 h-6">
                              {earning.exchange}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                        
                        {/* Estimate */}
                        <div>
                          <div className="text-xs text-muted-foreground mb-1 font-medium">ESTIMATE</div>
                          <span className="text-foreground font-medium">
                            {earning.estimate !== null && earning.estimate !== undefined
                              ? formatCurrency(earning.estimate)
                              : "-"}
                          </span>
                        </div>
                      </div>
                      
                      {/* Action Buttons for Mobile */}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {getActionIcons(earning.symbol).slice(0, 4).map((action, index) => {
                          const Icon = action.icon;
                          return (
                            <Button
                              key={index}
                              variant="outline"
                              size="sm"
                              className="h-8 px-3 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                action.onClick(earning.symbol);
                              }}
                              title={action.label}
                            >
                              <Icon className={cn("w-3 h-3 mr-1", action.colorClass)} />
                              {action.label.replace("Toggle ", "").replace("View ", "").replace("Set ", "")}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </React.Fragment>
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
