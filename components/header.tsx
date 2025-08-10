"use client";

import { useState, useEffect } from "react";
import { Building2, User, LogOut } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { WatchlistToggle } from "@/components/watchlist-toggle";
import { AuthModal } from "@/components/auth/auth-modal";
import { cn } from "@/lib/utils";
import { verifyToken } from "@/lib/auth";
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
