"use client";

import { Search, X } from "lucide-react";

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

  // Quick filter presets for mobile
  const quickFilters = [
    { label: "Big Tech", ticker: "AAPL,GOOGL,MSFT,AMZN,META" },
    { label: "AI Chips", ticker: "NVDA,AMD,INTC" },
    { label: "Cloud", ticker: "CRM,SNOW,DDOG" },
    { label: "Streaming", ticker: "NFLX,DIS,ROKU" },
  ];
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

  const handleQuickFilter = (quickFilter: typeof quickFilters[0]) => {
    handleTickerChange(quickFilter.ticker);
  };

  const clearFilters = () => {
    onFiltersChange({
      ticker: "",
      year: "2024",
      quarter: "all",
    });
  };

  const hasActiveFilters = filters.ticker.trim() || filters.quarter !== "all";

  return (
    <div className={cn("space-y-4 md:space-y-0 md:grid md:grid-cols-4 md:gap-4 mb-4 sm:mb-8 px-2 sm:px-0", className)}>
      {/* Mobile Quick Filters */}
      {isMobile && (
        <div className="md:hidden mb-3">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs text-muted-foreground">QUICK FILTERS</Label>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-6 px-2 text-xs text-muted-foreground"
                disabled={loading}
              >
                <X className="w-3 h-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {quickFilters.map((quickFilter) => (
              <Badge
                key={quickFilter.label}
                variant="outline"
                className="cursor-pointer hover:bg-accent transition-colors"
                onClick={() => handleQuickFilter(quickFilter)}
              >
                {quickFilter.label}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Ticker Input */}
      <div>
        <Label htmlFor="ticker-input" className="block text-xs sm:text-sm mb-1 sm:mb-2 text-foreground">
          TICKER
        </Label>
        <div className="relative">
          <Input 
            id="ticker-input"
            placeholder={isMobile ? "AAPL, GOOGL, MSFT..." : "e.g. AAPL"}
            value={filters.ticker}
            onChange={(e) => handleTickerChange(e.target.value)}
            className="h-9 sm:h-10 text-sm transition-all duration-200 hover:border-ring/50 focus-visible:border-ring pr-8"
            disabled={loading}
          />
          {filters.ticker && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleTickerChange("")}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 hover:bg-accent"
              disabled={loading}
              aria-label="Clear ticker"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
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
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2024">2024</SelectItem>
              <SelectItem value="2023">2023</SelectItem>
              <SelectItem value="2022">2022</SelectItem>
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
  );
}
