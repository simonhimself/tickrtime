"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

import type { WatchlistState, UseWatchlistReturn } from "@/types";

export function useWatchlist(): UseWatchlistReturn {
  const [watchlist, setWatchlist] = useState<WatchlistState>({
    tickers: [],
    lastUpdated: new Date().toISOString(),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get auth token from localStorage
  const getAuthToken = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('tickrtime-auth-token');
  };

  // Load watchlist from API on mount and when auth token changes
  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      loadWatchlist();
    } else {
      // Clear watchlist when no token
      setWatchlist({
        tickers: [],
        lastUpdated: new Date().toISOString(),
      });
    }
  }, []); // Remove loadWatchlist dependency to avoid circular dependency

  // Listen for authentication state changes
  useEffect(() => {
    const handleAuthChange = (event: CustomEvent) => {
      if (event.detail.action === 'login') {
        // User logged in, reload watchlist
        loadWatchlist();
      } else if (event.detail.action === 'logout') {
        // User logged out, clear watchlist
        setWatchlist({
          tickers: [],
          lastUpdated: new Date().toISOString(),
        });
      }
    };

    window.addEventListener('authStateChanged', handleAuthChange as EventListener);
    
    return () => {
      window.removeEventListener('authStateChanged', handleAuthChange as EventListener);
    };
  }, []); // Remove loadWatchlist dependency to avoid circular dependency

  // Load watchlist from API
  const loadWatchlist = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/watchlist', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired or invalid
          localStorage.removeItem('tickrtime-auth-token');
          setError('Authentication required');
          return;
        }
        throw new Error(`Failed to load watchlist: ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.watchlist) {
        setWatchlist(data.watchlist);
      }
    } catch (err: any) {
      console.error("Failed to load watchlist:", err);
      setError(err.message || "Failed to load watchlist");
    } finally {
      setLoading(false);
    }
  }, []);

  // Add ticker to watchlist
  const addToWatchlist = useCallback(async (symbol: string): Promise<boolean> => {
    const token = getAuthToken();
    if (!token) {
      toast.error("Please log in to save watchlist items");
      return false;
    }

    const normalizedSymbol = symbol.toUpperCase();
    
    // Check if already in watchlist
    if (watchlist.tickers.some((item) => item.symbol === normalizedSymbol)) {
      return true;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/watchlist', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ symbol: normalizedSymbol }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('tickrtime-auth-token');
          setError('Authentication required');
          return false;
        }
        throw new Error(`Failed to add to watchlist: ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.watchlist) {
        setWatchlist(data.watchlist);
        toast.success(`${normalizedSymbol} added to watchlist`);
        return true;
      } else {
        throw new Error(data.message || 'Failed to add to watchlist');
      }
    } catch (err: any) {
      console.error("Failed to add to watchlist:", err);
      setError(err.message || "Failed to add to watchlist");
      toast.error(err.message || "Failed to add to watchlist");
      return false;
    } finally {
      setLoading(false);
    }
  }, [watchlist.tickers]);

  // Remove ticker from watchlist
  const removeFromWatchlist = useCallback(async (symbol: string): Promise<boolean> => {
    const token = getAuthToken();
    if (!token) {
      toast.error("Please log in to manage watchlist items");
      return false;
    }

    const normalizedSymbol = symbol.toUpperCase();
    
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/watchlist?symbol=${encodeURIComponent(normalizedSymbol)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('tickrtime-auth-token');
          setError('Authentication required');
          return false;
        }
        throw new Error(`Failed to remove from watchlist: ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.watchlist) {
        setWatchlist(data.watchlist);
        toast.success(`${normalizedSymbol} removed from watchlist`);
        return true;
      } else {
        throw new Error(data.message || 'Failed to remove from watchlist');
      }
    } catch (err: any) {
      console.error("Failed to remove from watchlist:", err);
      setError(err.message || "Failed to remove from watchlist");
      toast.error(err.message || "Failed to remove from watchlist");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Check if ticker is in watchlist
  const isInWatchlist = useCallback((symbol: string) => {
    const normalizedSymbol = symbol.toUpperCase();
    return watchlist.tickers.some((item) => item.symbol === normalizedSymbol);
  }, [watchlist.tickers]);

  // Toggle ticker in watchlist
  const toggleWatchlist = useCallback(async (symbol: string): Promise<boolean> => {
    if (isInWatchlist(symbol)) {
      return await removeFromWatchlist(symbol);
    } else {
      return await addToWatchlist(symbol);
    }
  }, [isInWatchlist, removeFromWatchlist, addToWatchlist]);

  // Get all watched symbols as array
  const getWatchedSymbols = useCallback(() => {
    return watchlist.tickers.map((item) => item.symbol);
  }, [watchlist.tickers]);

  return {
    watchlist,
    addToWatchlist,
    removeFromWatchlist,
    isInWatchlist,
    toggleWatchlist,
    getWatchedSymbols,
    count: watchlist.tickers.length,
    loading,
    error,
  };
}
