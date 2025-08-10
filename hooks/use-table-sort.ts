"use client";

import { useState, useMemo } from "react";

import type { EarningsData, SortField, SortState, UseTableSortReturn } from "@/types";

export function useTableSort(data: EarningsData[]): UseTableSortReturn {
  const [sortState, setSortState] = useState<SortState>({
    field: null,
    direction: null,
  });

  // Sort the data based on current sort state
  const sortedData = useMemo(() => {
    if (!sortState.field || !sortState.direction) {
      return data;
    }

    return [...data].sort((a, b) => {
      const field = sortState.field!;
      let aValue: any = a[field];
      let bValue: any = b[field];

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) aValue = "";
      if (bValue === null || bValue === undefined) bValue = "";

      // Handle numeric fields
      if (field === "actual" || field === "estimate" || field === "surprisePercent") {
        aValue = Number(aValue) || 0;
        bValue = Number(bValue) || 0;
      }
      // Handle date fields
      else if (field === "date") {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }
      // Handle string fields
      else {
        aValue = String(aValue).toLowerCase();
        bValue = String(bValue).toLowerCase();
      }

      // Compare values
      let comparison = 0;
      if (aValue < bValue) {
        comparison = -1;
      } else if (aValue > bValue) {
        comparison = 1;
      }

      // Apply sort direction
      return sortState.direction === "desc" ? -comparison : comparison;
    });
  }, [data, sortState]);

  // Handle sort field selection
  const handleSort = (field: SortField) => {
    setSortState((prevState) => {
      if (prevState.field === field) {
        // Toggle direction or reset
        if (prevState.direction === "asc") {
          return { field, direction: "desc" };
        } else if (prevState.direction === "desc") {
          return { field: null, direction: null };
        } else {
          return { field, direction: "asc" };
        }
      } else {
        // New field, start with ascending
        return { field, direction: "asc" };
      }
    });
  };

  // Get sort icon for a field
  const getSortIcon = (field: SortField): "asc" | "desc" | null => {
    if (sortState.field === field) {
      return sortState.direction;
    }
    return null;
  };

  // Check if a field is sortable
  const isSortable = (_field: SortField): boolean => {
    // All fields are sortable in our implementation
    return true;
  };

  return {
    sortedData,
    sortState,
    handleSort,
    getSortIcon,
    isSortable,
  };
}
