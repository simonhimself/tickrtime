"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NavigationButtonsProps, TimePeriod } from "@/types";

const NAVIGATION_BUTTONS: Array<{
  id: TimePeriod;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    id: "previous30",
    label: "Previous 30 Days",
    shortLabel: "Past 30",
    description: "Show earnings from the past 30 days",
  },
  {
    id: "today",
    label: "Today",
    shortLabel: "Today",
    description: "Show today's earnings",
  },
  {
    id: "tomorrow",
    label: "Tomorrow",
    shortLabel: "Tomorrow", 
    description: "Show tomorrow's earnings",
  },
  {
    id: "next30",
    label: "Next 30 Days",
    shortLabel: "Next 30",
    description: "Show upcoming earnings for the next 30 days",
  },
];

export function NavigationButtons({
  activeButton,
  onButtonClick,
  loading = false,
  className,
}: NavigationButtonsProps) {
  return (
    <div className={cn("grid grid-cols-2 sm:flex gap-2 mb-4 sm:mb-6 px-2 sm:px-0", className)}>
      {NAVIGATION_BUTTONS.map((button) => (
        <Button
          key={button.id}
          variant={activeButton === button.id ? "default" : "outline"}
          className={cn(
            "h-9 sm:h-10 text-xs sm:text-sm transition-all duration-200",
            activeButton === button.id && "bg-primary text-primary-foreground shadow-md"
          )}
          onClick={() => onButtonClick(button.id)}
          disabled={loading}
          title={button.description}
          aria-pressed={activeButton === button.id}
        >
          <span className="sm:hidden">{button.shortLabel}</span>
          <span className="hidden sm:inline">{button.label}</span>
        </Button>
      ))}
    </div>
  );
}
