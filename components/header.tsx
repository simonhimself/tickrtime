"use client";

import { useState, useEffect } from "react";
import { Building2, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { WatchlistToggle } from "@/components/watchlist-toggle";
import { UserAvatar } from "@/components/user-avatar";
import { AuthModal } from "@/components/auth/auth-modal";
import { cn } from "@/lib/utils";
import { verifyToken } from "@/lib/auth";
import type { HeaderProps, User as UserType, AuthResponse } from "@/types";

export function Header({
  watchlistCount,
  onWatchlistClick,
  isWatchlistActive = false,
  className,
}: HeaderProps) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [user, setUser] = useState<UserType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing auth token on mount
  useEffect(() => {
    const validateToken = async () => {
      const token = localStorage.getItem("tickrtime-auth-token");
      if (token) {
        try {
          // Validate token and extract user info
          const userData = await verifyToken(token);
          if (userData) {
            setUser({
              id: userData.userId,
              email: userData.email,
              emailVerified: userData.emailVerified,
              createdAt: new Date().toISOString(), // We don't store this in JWT
              updatedAt: new Date().toISOString()
            });
          } else {
            // Invalid token, remove it
            localStorage.removeItem("tickrtime-auth-token");
          }
        } catch (error) {
          console.error("Error validating token:", error);
          localStorage.removeItem("tickrtime-auth-token");
        }
      }
      setIsLoading(false);
    };

    validateToken();
  }, []);

  const handleAuthSuccess = (response: AuthResponse) => {
    if (response.user) {
      setUser(response.user);
      // Dispatch custom event to notify other components about auth change
      window.dispatchEvent(new CustomEvent('authStateChanged', { 
        detail: { user: response.user, action: 'login' } 
      }));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("tickrtime-auth-token");
    setUser(null);
    // Dispatch custom event to notify other components about auth change
    window.dispatchEvent(new CustomEvent('authStateChanged', { 
      detail: { user: null, action: 'logout' } 
    }));
    // Reload the page to reset all state
    window.location.reload();
  };

  return (
    <>
      <header className={cn("flex items-center justify-between mb-4 sm:mb-8 px-2 sm:px-0", className)}>
        {/* Logo */}
        <div className="flex items-center gap-1 sm:gap-2">
          <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
          <Badge variant="outline" className="px-2 py-0.5 sm:px-3 sm:py-1 text-xs sm:text-sm font-semibold">
            TickrTime
          </Badge>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 sm:gap-2">
          <WatchlistToggle 
            count={watchlistCount}
            isActive={isWatchlistActive}
            onClick={onWatchlistClick}
          />
          <ThemeToggle />
          
          {/* Auth Button */}
          {!isLoading && (
            user ? (
              <UserAvatar 
                email={user.email}
                onLogout={handleLogout}
              />
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAuthModalOpen(true)}
                className="h-7 sm:h-8 px-2 sm:px-3 gap-1 sm:gap-2"
                title="Sign In"
              >
                <User className="h-3 w-3 sm:h-4 sm:w-4" />
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
