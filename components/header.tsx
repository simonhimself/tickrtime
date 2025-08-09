"use client";

import { Building2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { WatchlistToggle } from "@/components/watchlist-toggle";
import { cn } from "@/lib/utils";
import type { HeaderProps } from "@/types";

export function Header({
  watchlistCount,
  onWatchlistClick,
  onUserAction,
  className,
}: HeaderProps) {
  return (
    <header className={cn("flex items-center justify-between mb-8", className)}>
      {/* Logo */}
      <div className="flex items-center gap-2">
        <Building2 className="w-5 h-5 text-muted-foreground" />
        <Badge variant="outline" className="px-3 py-1 font-semibold">
          TickrTime
        </Badge>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <WatchlistToggle 
          count={watchlistCount}
          isActive={false} // Will be managed by parent component
          onClick={onWatchlistClick}
        />
        <ThemeToggle />
      </div>
    </header>
  );
}
