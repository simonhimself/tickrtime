"use client";

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

import { logger } from "@/lib/logger";
import { Header } from "@/components/header";
import { NavigationButtons } from "@/components/navigation-buttons";
import { SearchFilters } from "@/components/search-filters";
import { EarningsTable } from "@/components/earnings-table";
import { useWatchlist } from "@/hooks/use-watchlist";
import { useAlerts } from "@/hooks/use-alerts";
import { AlertDialog } from "@/components/alert-dialog";
import { getEarningsToday, getEarningsTomorrow, getEarningsNext30Days, getEarningsPrevious30Days, getEarnings, getEarningsWatchlist } from "@/lib/api-client";
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
  const [isAlertsMode, setIsAlertsMode] = useState(false);
  const [searchFilters, setSearchFilters] = useState<SearchFiltersType>({
    ticker: "",
    year: "2024",
    quarter: "all",
  });

  // Watchlist functionality
  const watchlist = useWatchlist();
  
  // Alerts functionality
  const alerts = useAlerts();

  // Alert dialog state
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [alertSymbol, setAlertSymbol] = useState<string>("");
  const [alertEarningsData, setAlertEarningsData] = useState<EarningsData | null>(null);

  // API loading functions
  const loadEarningsData = useCallback(async (loadFn: () => Promise<EarningsResponse>, period: TimePeriod) => {
    setViewState("loading");
    setActivePeriod(period);
    setIsSearchMode(false);
    setIsWatchlistMode(false);
    setIsAlertsMode(false);
    setError(null);
    
    try {
      const data = await loadFn();
      
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
    loadEarningsData(getEarningsToday, "today");
  }, [loadEarningsData]);

  const loadTomorrow = useCallback(() => {
    loadEarningsData(getEarningsTomorrow, "tomorrow");
  }, [loadEarningsData]);

  const loadNext30Days = useCallback(() => {
    loadEarningsData(getEarningsNext30Days, "next30");
  }, [loadEarningsData]);

  const loadPrevious30Days = useCallback(() => {
    loadEarningsData(getEarningsPrevious30Days, "previous30");
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
      const data = await getEarningsWatchlist(watchedSymbols);
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

  const loadAlertsEarnings = useCallback(async () => {
    const alertedSymbols = alerts.getAlertedSymbols();
    
    if (alertedSymbols.length === 0) {
      setEarnings([]);
      setViewState("empty");
      return;
    }

    setViewState("loading");
    setError(null);
    
    try {
      const data = await getEarningsWatchlist(alertedSymbols);
      setEarnings(data);
      setViewState(data.length > 0 ? "data" : "empty");
      
      toast.info(`Found ${data.length} upcoming earnings for your alerts`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to fetch alerts earnings";
      logger.error("Error fetching alerts earnings:", err);
      setError(errorMsg);
      setViewState("error");
    }
  }, [alerts]);


  const handleSearch = useCallback(async () => {
    if (!searchFilters.ticker.trim()) {
      toast.error("Please enter a ticker symbol");
      return;
    }

    setViewState("loading");
    setActivePeriod("search");
    setIsSearchMode(true);
    setIsWatchlistMode(false);
    setIsAlertsMode(false);
    setError(null);
    
    try {
      const data: EarningsResponse = await getEarnings({
        symbol: searchFilters.ticker.trim().toUpperCase(),
        year: searchFilters.year,
        quarter: searchFilters.quarter !== "all" ? searchFilters.quarter : undefined,
      });
      
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
      setIsAlertsMode(false);
      
      // Load all upcoming earnings for watchlisted symbols
      loadWatchlistEarnings();
    } else {
      // Return to previous view
      setActivePeriod("today");
      loadToday();
    }
  }, [isWatchlistMode, loadToday, loadWatchlistEarnings]);

  const toggleAlertsMode = useCallback(() => {
    const newAlertsMode = !isAlertsMode;
    setIsAlertsMode(newAlertsMode);
    
    if (newAlertsMode) {
      setActivePeriod("alerts");
      setIsSearchMode(false);
      setIsWatchlistMode(false);
      
      // Load all upcoming earnings for alerted symbols
      loadAlertsEarnings();
    } else {
      // Return to previous view
      setActivePeriod("today");
      loadToday();
    }
  }, [isAlertsMode, loadToday, loadAlertsEarnings]);

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
      case "View Details": {
        toast.info(`Viewing details for ${symbol}`);
        break;
      }
      case "Set Alert": {
        const earning = earnings.find((e) => e.symbol === symbol);
        setAlertSymbol(symbol);
        setAlertEarningsData(earning || null);
        setAlertDialogOpen(true);
        break;
      }
      case "View Chart": {
        // Look up exchange from earnings data
        const earning = earnings.find((e) => e.symbol === symbol);
        const exchange = earning?.exchange;
        // Format: EXCHANGE:SYMBOL (e.g., NASDAQ:AAPL) or just SYMBOL if no exchange
        const symbolParam = exchange ? `${exchange}:${symbol}` : symbol;
        const tradingViewUrl = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbolParam)}`;
        window.open(tradingViewUrl, '_blank');
        toast.info(`Opening chart for ${symbol}`);
        break;
      }
      case "More Actions": {
        toast.info(`More actions for ${symbol}`);
        break;
      }
      default: {
        logger.debug("Unknown action:", action);
      }
    }
  }, [earnings]);

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

  const handleAlertsClick = useCallback(() => {
    if (alerts.count === 0) {
      toast.info("You have no active alerts. Set alerts from the earnings table to get notified!");
    } else {
      toggleAlertsMode();
    }
  }, [alerts.count, toggleAlertsMode]);

  // Load initial data
  useEffect(() => {
    loadToday();
  }, [loadToday]);

  // Get description text based on current state
  const getDescriptionText = () => {
    if (isAlertsMode) {
      return `Showing earnings for your ${alerts.count} alerted tickers. ${
        alerts.count === 0 
          ? "Set alerts from the earnings table to get notified." 
          : "Click the alerts icon again to return to the main view."
      }`;
    }
    
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
  
  // Get alerted items as Set for table
  const alertedItems = new Set(alerts.getAlertedSymbols());

  return (
    <div className="min-h-screen bg-background p-2 sm:p-4 md:p-6 transition-colors">
      <div className="max-w-7xl mx-auto">
        <Header 
          watchlistCount={watchlist.count}
          onWatchlistClick={handleWatchlistClick}
          isWatchlistActive={isWatchlistMode}
          alertsCount={alerts.count}
          onAlertsClick={handleAlertsClick}
          isAlertsActive={isAlertsMode}
          onUserAction={(action) => toast.info(`User action: ${action}`)}
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
            alertedItems={alertedItems}
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

      <AlertDialog
        open={alertDialogOpen}
        onOpenChange={setAlertDialogOpen}
        symbol={alertSymbol}
        earningsData={alertEarningsData}
        onSuccess={() => {
          toast.success(`Alert created successfully for ${alertSymbol}`);
          // Refresh alerts state
          alerts.refresh();
          // Dispatch event to notify other components
          window.dispatchEvent(new CustomEvent('alertsChanged'));
        }}
      />
    </div>
  );
}
