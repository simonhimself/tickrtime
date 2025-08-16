"use client";

import React from "react";
import { ChevronDown, ChevronUp, ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { SortField, SortDirection } from "@/types";

interface MobileSortDropdownProps {
  sortField: SortField | null;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  className?: string;
}

interface SortOption {
  field: SortField;
  label: string;
}

const SORT_OPTIONS: SortOption[] = [
  { field: "date", label: "Date" },
  { field: "symbol", label: "Ticker" },
  { field: "actual", label: "EPS" },
  { field: "surprisePercent", label: "Surprise" },
  { field: "estimate", label: "Estimate" },
  { field: "exchange", label: "Exchange" },
];

export function MobileSortDropdown({
  sortField,
  sortDirection,
  onSort,
  className,
}: MobileSortDropdownProps) {
  // Ensure we always have a valid sort field, defaulting to 'date'
  const currentSortField = sortField || 'date';

  const handleSortChange = (value: string) => {
    const field = value as SortField;
    onSort(field);
  };

  const getSortIcon = () => {
    if (!sortDirection) return <ArrowUpDown className="w-4 h-4" />;
    return sortDirection === "asc" 
      ? <ChevronUp className="w-4 h-4" />
      : <ChevronDown className="w-4 h-4" />;
  };

  return (
    <div className={cn("sticky top-0 z-20 bg-gray-50/90 dark:bg-gray-900/90 backdrop-blur-sm supports-[backdrop-filter]:bg-gray-50/80 dark:supports-[backdrop-filter]:bg-gray-900/80 border-b border-border shadow-sm", className)}>
      <div className="px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Sort by:</span>
          <Select value={currentSortField} onValueChange={handleSortChange}>
            <SelectTrigger className="w-auto h-8 gap-2 border-0 bg-transparent active:bg-accent transition-colors">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.field} value={option.field}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => onSort(currentSortField)}
          title={`Sort ${sortDirection === "asc" ? "descending" : "ascending"}`}
          aria-label={`Sort by ${SORT_OPTIONS.find(opt => opt.field === currentSortField)?.label} ${sortDirection === "asc" ? "descending" : "ascending"}`}
        >
          {getSortIcon()}
        </Button>
      </div>
    </div>
  );
}