"use client";

import { useState, useEffect } from "react";

import type { WatchlistItem, WatchlistState, UseWatchlistReturn } from "@/types";

const STORAGE_KEY = "tickrtime-watchlist";

export function useWatchlist(): UseWatchlistReturn {
  const [watchlist, setWatchlist] = useState<WatchlistState>({
    tickers: [],
    lastUpdated: new Date().toISOString(),
  });

  // Load watchlist from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setWatchlist(parsed);
      }
    } catch (error) {
      console.error("Failed to load watchlist:", error);
    }
  }, []);

  // Save to localStorage whenever watchlist changes
  const saveWatchlist = (newWatchlist: WatchlistState) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newWatchlist));
      setWatchlist(newWatchlist);
    } catch (error) {
      console.error("Failed to save watchlist:", error);
    }
  };

  // Add ticker to watchlist
  const addToWatchlist = (symbol: string) => {
    const normalizedSymbol = symbol.toUpperCase();
    
    // Check if already in watchlist
    if (watchlist.tickers.some((item) => item.symbol === normalizedSymbol)) {
      return;
    }

    const newWatchlist: WatchlistState = {
      tickers: [
        ...watchlist.tickers,
        {
          symbol: normalizedSymbol,
          addedAt: new Date().toISOString(),
        },
      ],
      lastUpdated: new Date().toISOString(),
    };

    saveWatchlist(newWatchlist);
  };

  // Remove ticker from watchlist
  const removeFromWatchlist = (symbol: string) => {
    const normalizedSymbol = symbol.toUpperCase();
    
    const newWatchlist: WatchlistState = {
      tickers: watchlist.tickers.filter((item) => item.symbol !== normalizedSymbol),
      lastUpdated: new Date().toISOString(),
    };

    saveWatchlist(newWatchlist);
  };

  // Check if ticker is in watchlist
  const isInWatchlist = (symbol: string) => {
    const normalizedSymbol = symbol.toUpperCase();
    return watchlist.tickers.some((item) => item.symbol === normalizedSymbol);
  };

  // Toggle ticker in watchlist
  const toggleWatchlist = (symbol: string) => {
    if (isInWatchlist(symbol)) {
      removeFromWatchlist(symbol);
    } else {
      addToWatchlist(symbol);
    }
  };

  // Get all watched symbols as array
  const getWatchedSymbols = () => {
    return watchlist.tickers.map((item) => item.symbol);
  };

  return {
    watchlist,
    addToWatchlist,
    removeFromWatchlist,
    isInWatchlist,
    toggleWatchlist,
    getWatchedSymbols,
    count: watchlist.tickers.length,
  };
}
