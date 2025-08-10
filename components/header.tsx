"use client";

import { useState, useEffect } from "react";
import { Building2, User, LogOut } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { WatchlistToggle } from "@/components/watchlist-toggle";
import { AuthModal } from "@/components/auth/auth-modal";
import { cn } from "@/lib/utils";
import type { HeaderProps, User as UserType, AuthResponse } from "@/types";

export function Header({
  watchlistCount,
  onWatchlistClick,
  className,
}: HeaderProps) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [user, setUser] = useState<UserType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing auth token on mount
  useEffect(() => {
    const token = localStorage.getItem("tickrtime-auth-token");
    if (token) {
      // TODO: Validate token with backend
      // For now, we'll just assume the user is logged in
      setUser({ id: "temp", email: "user@example.com", emailVerified: true, createdAt: "", updatedAt: "" });
    }
    setIsLoading(false);
  }, []);

  const handleAuthSuccess = (response: AuthResponse) => {
    if (response.user) {
      setUser(response.user);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("tickrtime-auth-token");
    setUser(null);
    // Reload the page to reset all state
    window.location.reload();
  };

  return (
    <>
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
          
          {/* Auth Button */}
          {!isLoading && (
            user ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  {user.email}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="h-8 gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAuthModalOpen(true)}
                className="h-8 gap-2"
              >
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Sign In</span>
              </Button>
            )
          )}
        </div>
      </header>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
        defaultMode="login"
      />
    </>
  );
}
