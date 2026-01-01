"use client";

import { useState } from "react";
import { Search, ChevronDown, ChevronUp, Filter, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-media-query";
import type { SearchFiltersProps } from "@/types";

export function SearchFilters({
  filters,
  onFiltersChange,
  onSearch,
  loading = false,
  className,
}: SearchFiltersProps) {
  const isMobile = useIsMobile();
  const [isExpanded, setIsExpanded] = useState(!isMobile); // Expanded by default on desktop
  
  
  const handleTickerChange = (value: string) => {
    onFiltersChange({
      ...filters,
      ticker: value,
    });
  };

  const handleYearChange = (value: string) => {
    onFiltersChange({
      ...filters,
      year: value,
    });
  };

  const handleQuarterChange = (value: string) => {
    onFiltersChange({
      ...filters,
      quarter: value,
    });
  };

  // Helper to check if filters are active
  const hasActiveFilters = filters.ticker.trim() || filters.quarter !== "all";
  const activeFilterCount = [
    filters.ticker.trim(),
    filters.quarter !== "all" ? filters.quarter : null,
  ].filter(Boolean).length;

  // Clear all filters
  const clearFilters = () => {
    onFiltersChange({
      ticker: "",
      year: String(new Date().getFullYear()),
      quarter: "all",
    });
  };

  return (
    <div className={cn("bg-muted/30 rounded-lg p-4", className)}>
      {/* Description */}
      <p className="text-sm text-muted-foreground mb-4">
        Find historical earnings for a specific stock by ticker symbol.
      </p>

      {/* Mobile Filter Toggle */}
      {isMobile && (
        <div className="flex items-center justify-between mb-3">
          <Button
            variant="outline"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 h-9"
            disabled={loading}
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1 text-xs">
                {activeFilterCount}
              </Badge>
            )}
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-muted-foreground hover:text-foreground"
              disabled={loading}
            >
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      )}

      {/* Filter Content */}
      <div
        className={cn(
          "transition-all duration-200",
          isMobile && "overflow-hidden",
          isMobile && !isExpanded ? "max-h-0 opacity-0" : "max-h-none opacity-100",
          !isMobile && "space-y-4 md:space-y-0 md:grid md:grid-cols-4 md:gap-4",
          isMobile && "space-y-3"
        )}
      >
        {/* Ticker Input */}
      <div>
        <Label htmlFor="ticker-input" className="block text-xs sm:text-sm mb-1 sm:mb-2 text-foreground">
          TICKER
        </Label>
        <Input 
          id="ticker-input"
          placeholder="e.g. AAPL"
          value={filters.ticker}
          onChange={(e) => handleTickerChange(e.target.value)}
          className="h-9 sm:h-10 text-sm transition-all duration-200 hover:border-ring/50 focus-visible:border-ring"
          disabled={loading}
        />
      </div>

      {/* Mobile: Year and Quarter in a row */}
      <div className="grid grid-cols-2 gap-2 md:contents">
        {/* Year Select */}
        <div className="md:col-auto">
          <Label htmlFor="year-select" className="block text-xs sm:text-sm mb-1 sm:mb-2 text-foreground">
            YEAR
          </Label>
          <Select value={filters.year} onValueChange={handleYearChange} disabled={loading}>
            <SelectTrigger 
              id="year-select"
              className="h-9 sm:h-10 text-sm transition-all duration-200 hover:border-ring/50"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {/* Generate current year + 3 previous years dynamically */}
              {Array.from({ length: 4 }, (_, i) => {
                const year = new Date().getFullYear() - i;
                return (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Quarter Select */}
        <div className="md:col-auto">
          <Label htmlFor="quarter-select" className="block text-xs sm:text-sm mb-1 sm:mb-2 text-foreground">
            QUARTER
          </Label>
          <Select value={filters.quarter} onValueChange={handleQuarterChange} disabled={loading}>
            <SelectTrigger 
              id="quarter-select"
              className="h-9 sm:h-10 text-sm transition-all duration-200 hover:border-ring/50"
            >
              <SelectValue placeholder="All Quarters" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Quarters</SelectItem>
              <SelectItem value="1">Q1</SelectItem>
              <SelectItem value="2">Q2</SelectItem>
              <SelectItem value="3">Q3</SelectItem>
              <SelectItem value="4">Q4</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Search Button */}
      <div className="md:col-auto">
        <Label className="hidden md:block text-sm mb-2 text-transparent select-none" aria-hidden="true">
          Search
        </Label>
        <Button 
          variant="outline" 
          className="w-full h-9 sm:h-10 md:mt-0 text-sm" 
          onClick={onSearch}
          disabled={loading || !filters.ticker.trim()}
        >
          <Search className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
          {loading ? "Searching..." : "Search"}
        </Button>
        </div>
      </div>
    </div>
  );
}
