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
  const currentOption = SORT_OPTIONS.find(option => option.field === sortField);
  const currentLabel = currentOption ? currentOption.label : "Date";

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

  const getSortText = () => {
    if (!sortDirection) return "";
    return sortDirection === "asc" ? " ↑" : " ↓";
  };

  return (
    <div className={cn("sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border", className)}>
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Sort by:</span>
          <Select value={sortField || "date"} onValueChange={handleSortChange}>
            <SelectTrigger className="w-auto h-8 gap-2 border-0 bg-transparent hover:bg-accent transition-colors">
              <div className="flex items-center gap-1">
                <SelectValue />
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  {getSortText()}
                </span>
              </div>
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
          onClick={() => sortField && onSort(sortField)}
          title={`Sort ${sortDirection === "asc" ? "descending" : "ascending"}`}
        >
          {getSortIcon()}
        </Button>
      </div>
    </div>
  );
}