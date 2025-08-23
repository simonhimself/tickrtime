"use client";

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

import { logger } from "@/lib/logger";
import { Header } from "@/components/header";
import { NavigationButtons } from "@/components/navigation-buttons";
import { SearchFilters } from "@/components/search-filters";
import { EarningsTable } from "@/components/earnings-table";
import { useWatchlist } from "@/hooks/use-watchlist";
import type { 
  EarningsData, 
  ViewState, 
  TimePeriod, 
  SearchFilters as SearchFiltersType,
  EarningsResponse 
} from "@/types";

export function EarningsDashboard() {
  // State management
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [earnings, setEarnings] = useState<EarningsData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activePeriod, setActivePeriod] = useState<TimePeriod>("today");
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [isWatchlistMode, setIsWatchlistMode] = useState(false);
  const [searchFilters, setSearchFilters] = useState<SearchFiltersType>({
    ticker: "",
    year: "2024",
    quarter: "all",
  });

  // Watchlist functionality
  const watchlist = useWatchlist();

  // API loading functions
  const loadEarningsData = useCallback(async (endpoint: string, period: TimePeriod) => {
    setViewState("loading");
    setActivePeriod(period);
    setIsSearchMode(false);
    setIsWatchlistMode(false);
    setError(null);
    
    try {
      const response = await fetch(endpoint);
      
      let data: EarningsResponse;
      try {
        data = await response.json();
      } catch (jsonError) {
        // If JSON parsing fails, create an error response
        data = { 
          earnings: [], 
          error: `Server error: ${response.status} ${response.statusText}` 
        };
      }
      
      if (!response.ok) {
        throw new Error(data.error || `Failed to fetch earnings data: ${response.status}`);
      }
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      if (data.earnings && data.earnings.length > 0) {
        setEarnings(data.earnings);
        setViewState("data");
      } else {
        setEarnings([]);
        setViewState("empty");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load earnings data");
      setViewState("error");
      toast.error(`Failed to load ${period} earnings`);
    }
  }, []);

  const loadToday = useCallback(() => {
    loadEarningsData("/api/earnings-today", "today");
  }, [loadEarningsData]);

  const loadTomorrow = useCallback(() => {
    loadEarningsData("/api/earnings-tomorrow", "tomorrow");
  }, [loadEarningsData]);

  const loadNext30Days = useCallback(() => {
    loadEarningsData("/api/earnings-next-30-days", "next30");
  }, [loadEarningsData]);

  const loadPrevious30Days = useCallback(() => {
    loadEarningsData("/api/earnings-previous-30-days", "previous30");
  }, [loadEarningsData]);

  const loadWatchlistEarnings = useCallback(async () => {
    const watchedSymbols = watchlist.getWatchedSymbols();
    
    if (watchedSymbols.length === 0) {
      setEarnings([]);
      setViewState("empty");
      return;
    }

    setViewState("loading");
    setError(null);
    
    try {
      const response = await fetch(`/api/earnings-watchlist?symbols=${watchedSymbols.join(",")}`);
      
      if (!response.ok) {
        const errorMsg = `Failed to fetch watchlist earnings: ${response.status}`;
        logger.error(errorMsg);
        setError(errorMsg);
        setViewState("error");
        return;
      }

      const data = await response.json();
      setEarnings(data);
      setViewState(data.length > 0 ? "data" : "empty");
      
      toast.info(`Found ${data.length} upcoming earnings for your watchlist`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to fetch watchlist earnings";
      logger.error("Error fetching watchlist earnings:", err);
      setError(errorMsg);
      setViewState("error");
    }
  }, [watchlist]);

  const handleSearch = useCallback(async () => {
    if (!searchFilters.ticker.trim()) {
      toast.error("Please enter a ticker symbol");
      return;
    }

    setViewState("loading");
    setActivePeriod("search");
    setIsSearchMode(true);
    setIsWatchlistMode(false);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        symbol: searchFilters.ticker.trim().toUpperCase(),
        year: searchFilters.year,
      });
      
      if (searchFilters.quarter && searchFilters.quarter !== "all") {
        params.append("quarter", searchFilters.quarter);
      }
      
      const response = await fetch(`/api/earnings?${params.toString()}`);
      
      let data: EarningsResponse;
      try {
        data = await response.json();
      } catch (jsonError) {
        // If JSON parsing fails, create an error response
        data = { 
          earnings: [], 
          error: `Server error: ${response.status} ${response.statusText}` 
        };
      }
      
      if (!response.ok) {
        throw new Error(data.error || `Failed to search earnings: ${response.status}`);
      }
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      if (data.earnings && data.earnings.length > 0) {
        setEarnings(data.earnings);
        setViewState("data");
        toast.success(`Found ${data.earnings.length} earnings records for ${searchFilters.ticker.toUpperCase()}`);
      } else {
        setEarnings([]);
        setViewState("empty");
        toast.info(`No earnings found for ${searchFilters.ticker.toUpperCase()}`);
      }
    } catch (err: any) {
      setError(err.message || "Failed to search earnings");
      setViewState("error");
      toast.error("Search failed");
    }
  }, [searchFilters]);

  const toggleWatchlistMode = useCallback(() => {
    const newWatchlistMode = !isWatchlistMode;
    setIsWatchlistMode(newWatchlistMode);
    
    if (newWatchlistMode) {
      setActivePeriod("watchlist");
      setIsSearchMode(false);
      
      // Load all upcoming earnings for watchlisted symbols
      loadWatchlistEarnings();
    } else {
      // Return to previous view
      setActivePeriod("today");
      loadToday();
    }
  }, [isWatchlistMode, loadToday, loadWatchlistEarnings]);

  // Navigation handlers
  const handleNavigationClick = useCallback((period: TimePeriod) => {
    switch (period) {
      case "today":
        loadToday();
        break;
      case "tomorrow":
        loadTomorrow();
        break;
      case "next30":
        loadNext30Days();
        break;
      case "previous30":
        loadPrevious30Days();
        break;
      default:
        break;
    }
  }, [loadToday, loadTomorrow, loadNext30Days, loadPrevious30Days]);

  // Row action handlers
  const handleRowAction = useCallback((action: string, symbol: string) => {
    switch (action) {
      case "View Details":
        toast.info(`Viewing details for ${symbol}`);
        break;
      case "Set Alert":
        toast.success(`Alert set for ${symbol}`);
        break;
      case "View Chart":
        toast.info(`Opening chart for ${symbol}`);
        break;
      case "More Actions":
        toast.info(`More actions for ${symbol}`);
        break;
      default:
        logger.debug("Unknown action:", action);
    }
  }, []);

  const handleWatchlistToggle = useCallback(async (symbol: string) => {
    const wasInWatchlist = watchlist.isInWatchlist(symbol);
    const success = await watchlist.toggleWatchlist(symbol);
    
    if (success) {
      if (wasInWatchlist) {
        toast.info(`${symbol} removed from watchlist`);
      } else {
        toast.success(`${symbol} added to watchlist`);
      }
    }
    
    return success;
  }, [watchlist]);

  const handleWatchlistClick = useCallback(() => {
    if (watchlist.count === 0) {
      toast.info("Your watchlist is empty. Add some stocks by clicking the bookmark icon!");
    } else {
      toggleWatchlistMode();
    }
  }, [watchlist.count, toggleWatchlistMode]);

  // Load initial data
  useEffect(() => {
    loadToday();
  }, [loadToday]);

  // Get description text based on current state
  const getDescriptionText = () => {
    if (isWatchlistMode) {
      return `Showing earnings for your ${watchlist.count} watched tickers. ${
        watchlist.count === 0 
          ? "Add tickers to your watchlist using the floating actions." 
          : "Click the watchlist icon again to return to the main view."
      }`;
    }
    
    if (isSearchMode) {
      return searchFilters.ticker
        ? `Showing earnings data for ${searchFilters.ticker.toUpperCase()} in ${searchFilters.year} ${
            searchFilters.quarter && searchFilters.quarter !== "all" ? `Q${searchFilters.quarter}` : "(all quarters)"
          }.`
        : `Showing earnings data for all tech stocks in ${searchFilters.year} ${
            searchFilters.quarter && searchFilters.quarter !== "all" ? `Q${searchFilters.quarter}` : "(all quarters)"
          }.`;
    }

    switch (activePeriod) {
      case "next30":
        return "Showing tech earnings for the next 30 days. Use the buttons above for quick navigation, or use the search filters below for specific queries.";
      case "previous30":
        return "Showing tech earnings for the previous 30 days. Use the buttons above for quick navigation, or use the search filters below for specific queries.";
      case "today":
        return "Showing tech earnings for today. Use the buttons above for quick navigation, or use the search filters below for specific queries.";
      case "tomorrow":
        return "Showing tech earnings for tomorrow. Use the buttons above for quick navigation, or use the search filters below for specific queries.";
      default:
        return "Select a time period or search for specific earnings data.";
    }
  };

  // Get watchlisted items as Set for table
  const watchlistedItems = new Set(watchlist.getWatchedSymbols());

  return (
    <div className="min-h-screen bg-background p-2 sm:p-4 md:p-6 transition-colors">
      <div className="max-w-7xl mx-auto">
        <Header 
          watchlistCount={watchlist.count}
          onWatchlistClick={handleWatchlistClick}
          onUserAction={(action) => toast.info(`User action: ${action}`)}
          isWatchlistActive={isWatchlistMode}
        />
        
        <main>
          {/* Title and Description */}
          <section className="mb-4 sm:mb-8 px-2 sm:px-0">
            <h1 className="mb-2 sm:mb-4 text-foreground font-bold text-2xl sm:text-3xl md:text-4xl">
              TickrTime, never miss earnings again
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground mb-4 sm:mb-6">
              {getDescriptionText()}
            </p>
            
            <NavigationButtons 
              activeButton={activePeriod}
              onButtonClick={handleNavigationClick}
              loading={viewState === "loading"}
            />
          </section>

          <SearchFilters 
            filters={searchFilters}
            onFiltersChange={setSearchFilters}
            onSearch={handleSearch}
            loading={viewState === "loading"}
          />
          
          <EarningsTable 
            data={earnings}
            loading={viewState === "loading"}
            error={error}
            onRowAction={handleRowAction}
            watchlistedItems={watchlistedItems}
            onToggleWatchlist={handleWatchlistToggle}
          />
        </main>

        {/* Help Text */}
        <footer className="mt-8 text-center text-sm text-muted-foreground">
          <p>
            Hover over any row to see available actions. Click column headers to sort data. 
            The bookmark icon adds stocks to your watchlist ({watchlist.count} item{watchlist.count === 1 ? "" : "s"} currently).
          </p>
        </footer>
      </div>
    </div>
  );
}
