"use client";

import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AlertsToggleProps {
  count: number;
  isActive: boolean;
  onClick: () => void;
  className?: string;
}

export function AlertsToggle({ count, isActive, onClick, className }: AlertsToggleProps) {
  return (
    <Button
      variant={isActive ? "default" : "ghost"}
      size="sm"
      onClick={onClick}
      className={cn("h-7 sm:h-8 px-2 sm:px-3 gap-1 sm:gap-2", className)}
      title={`${isActive ? "Hide" : "Show"} alerts (${count} items)`}
    >
      <Bell className={cn("h-3 w-3 sm:h-4 sm:w-4", isActive && "fill-current")} />
      {count > 0 && (
        <Badge
          variant={isActive ? "secondary" : "default"}
          className="h-4 sm:h-5 min-w-4 sm:min-w-5 px-1 sm:px-1.5 text-[10px] sm:text-xs"
        >
          {count}
        </Badge>
      )}
      <span className="sr-only">Toggle alerts</span>
    </Button>
  );
}


