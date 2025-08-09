"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NavigationButtonsProps, TimePeriod } from "@/types";

const NAVIGATION_BUTTONS: Array<{
  id: TimePeriod;
  label: string;
  description: string;
}> = [
  {
    id: "previous30",
    label: "Previous 30 Days",
    description: "Show earnings from the past 30 days",
  },
  {
    id: "today",
    label: "Today",
    description: "Show today's earnings",
  },
  {
    id: "tomorrow",
    label: "Tomorrow", 
    description: "Show tomorrow's earnings",
  },
  {
    id: "next30",
    label: "Next 30 Days",
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
    <div className={cn("flex gap-2 mb-6 flex-wrap", className)}>
      {NAVIGATION_BUTTONS.map((button) => (
        <Button
          key={button.id}
          variant={activeButton === button.id ? "default" : "outline"}
          className={cn(
            "transition-all duration-200",
            activeButton === button.id && "bg-primary text-primary-foreground shadow-md"
          )}
          onClick={() => onButtonClick(button.id)}
          disabled={loading}
          title={button.description}
          aria-pressed={activeButton === button.id}
        >
          {button.label}
        </Button>
      ))}
    </div>
  );
}
