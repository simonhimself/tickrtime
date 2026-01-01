"use client";

import React from "react";
import { Calendar, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type FilterTab = "browse" | "search";

interface FilterTabsProps {
  activeTab: FilterTab;
  onTabChange: (tab: FilterTab) => void;
  className?: string;
}

export function FilterTabs({ activeTab, onTabChange, className }: FilterTabsProps) {
  return (
    <div className={cn("flex border-b border-border", className)}>
      <button
        type="button"
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors",
          activeTab === "browse"
            ? "border-b-2 border-primary text-primary -mb-px"
            : "text-muted-foreground hover:text-foreground"
        )}
        onClick={() => onTabChange("browse")}
        aria-selected={activeTab === "browse"}
        role="tab"
      >
        <Calendar className="w-4 h-4" />
        <span>Browse</span>
      </button>
      <button
        type="button"
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors",
          activeTab === "search"
            ? "border-b-2 border-primary text-primary -mb-px"
            : "text-muted-foreground hover:text-foreground"
        )}
        onClick={() => onTabChange("search")}
        aria-selected={activeTab === "search"}
        role="tab"
      >
        <Search className="w-4 h-4" />
        <span>Search</span>
      </button>
    </div>
  );
}
