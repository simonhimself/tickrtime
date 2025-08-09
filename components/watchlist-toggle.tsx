"use client";

import { Bookmark } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface WatchlistToggleProps {
  count: number;
  isActive: boolean;
  onClick: () => void;
  className?: string;
}

export function WatchlistToggle({ count, isActive, onClick, className }: WatchlistToggleProps) {
  return (
    <Button
      variant={isActive ? "default" : "ghost"}
      size="sm"
      onClick={onClick}
      className={cn("h-8 gap-2", className)}
      title={`${isActive ? "Hide" : "Show"} watchlist (${count} items)`}
    >
      <Bookmark className={cn("h-4 w-4", isActive && "fill-current")} />
      {count > 0 && (
        <Badge
          variant={isActive ? "secondary" : "default"}
          className="h-5 min-w-5 px-1.5 text-xs"
        >
          {count}
        </Badge>
      )}
      <span className="sr-only">Toggle watchlist</span>
    </Button>
  );
}
