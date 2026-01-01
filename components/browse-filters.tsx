"use client";

import React from "react";
import { NavigationButtons } from "@/components/navigation-buttons";
import { cn } from "@/lib/utils";
import type { TimePeriod } from "@/types";

interface BrowseFiltersProps {
  activePeriod: TimePeriod;
  onPeriodChange: (period: TimePeriod) => void;
  selectedSector: string;
  onSectorChange: (sector: string) => void;
  selectedIndustry: string;
  onIndustryChange: (industry: string) => void;
  availableSectors: string[];
  availableIndustries: string[];
  resultCount: { filtered: number; total: number };
  loading: boolean;
  className?: string;
}

export function BrowseFilters({
  activePeriod,
  onPeriodChange,
  selectedSector,
  onSectorChange,
  selectedIndustry,
  onIndustryChange,
  availableSectors,
  availableIndustries,
  resultCount,
  loading,
  className,
}: BrowseFiltersProps) {
  const showResultCount = selectedSector !== "all" || selectedIndustry !== "all";
  const industryDisabled = selectedSector === "all";

  return (
    <div className={cn("bg-muted/30 rounded-lg p-4 space-y-4", className)}>
      {/* Time Navigation Row */}
      <NavigationButtons
        activeButton={activePeriod}
        onButtonClick={onPeriodChange}
        loading={loading}
        className="mb-0 px-0"
      />

      {/* Sector/Industry Filter Row */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Sector Dropdown */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="sector-filter"
            className="text-sm text-muted-foreground whitespace-nowrap"
          >
            Sector:
          </label>
          <select
            id="sector-filter"
            value={selectedSector}
            onChange={(e) => onSectorChange(e.target.value)}
            disabled={loading}
            className={cn(
              "px-3 py-1.5 text-sm border rounded-md bg-background text-foreground",
              "focus:outline-none focus:ring-2 focus:ring-ring",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <option value="all">All Sectors</option>
            {availableSectors.map((sector) => (
              <option key={sector} value={sector}>
                {sector}
              </option>
            ))}
          </select>
        </div>

        {/* Industry Dropdown (hierarchical - depends on sector) */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="industry-filter"
            className={cn(
              "text-sm whitespace-nowrap",
              industryDisabled ? "text-muted-foreground/50" : "text-muted-foreground"
            )}
          >
            Industry:
          </label>
          <select
            id="industry-filter"
            value={selectedIndustry}
            onChange={(e) => onIndustryChange(e.target.value)}
            disabled={loading || industryDisabled}
            className={cn(
              "px-3 py-1.5 text-sm border rounded-md bg-background text-foreground",
              "focus:outline-none focus:ring-2 focus:ring-ring",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              industryDisabled && "bg-muted/50 border-muted-foreground/20"
            )}
          >
            <option value="all">
              {industryDisabled ? "Select sector first" : "All Industries"}
            </option>
            {availableIndustries.map((industry) => (
              <option key={industry} value={industry}>
                {industry}
              </option>
            ))}
          </select>
        </div>

        {/* Results Count */}
        {showResultCount && (
          <span className="text-sm text-muted-foreground ml-auto">
            {resultCount.filtered} of {resultCount.total} results
          </span>
        )}
      </div>
    </div>
  );
}
