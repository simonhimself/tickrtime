"use client";

import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { SearchFiltersProps } from "@/types";

export function SearchFilters({
  filters,
  onFiltersChange,
  onSearch,
  loading = false,
  className,
}: SearchFiltersProps) {
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

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-4 gap-4 mb-8", className)}>
      {/* Ticker Input */}
      <div>
        <Label htmlFor="ticker-input" className="block text-sm mb-2 text-foreground">
          TICKER
        </Label>
        <Input 
          id="ticker-input"
          placeholder="e.g. AAPL"
          value={filters.ticker}
          onChange={(e) => handleTickerChange(e.target.value)}
          className="transition-all duration-200 hover:border-ring/50 focus-visible:border-ring"
          disabled={loading}
        />
      </div>

      {/* Year Select */}
      <div>
        <Label htmlFor="year-select" className="block text-sm mb-2 text-foreground">
          YEAR
        </Label>
        <Select value={filters.year} onValueChange={handleYearChange} disabled={loading}>
          <SelectTrigger 
            id="year-select"
            className="transition-all duration-200 hover:border-ring/50"
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
      <div>
        <Label htmlFor="quarter-select" className="block text-sm mb-2 text-foreground">
          QUARTER
        </Label>
        <Select value={filters.quarter} onValueChange={handleQuarterChange} disabled={loading}>
          <SelectTrigger 
            id="quarter-select"
            className="transition-all duration-200 hover:border-ring/50"
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

      {/* Search Button */}
      <div>
        <Label className="block text-sm mb-2 text-transparent select-none" aria-hidden="true">
          Search
        </Label>
        <Button 
          variant="outline" 
          className="w-full" 
          onClick={onSearch}
          disabled={loading || !filters.ticker.trim()}
        >
          <Search className="w-4 h-4 mr-2" />
          {loading ? "Searching..." : "Search"}
        </Button>
      </div>
    </div>
  );
}
