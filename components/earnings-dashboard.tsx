"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";

import { logger } from "@/lib/logger";
import { Header } from "@/components/header";
import { NavigationButtons } from "@/components/navigation-buttons";
import { SearchFilters } from "@/components/search-filters";
import { EarningsTable } from "@/components/earnings-table";
import { useWatchlist } from "@/hooks/use-watchlist";
import { useAlerts } from "@/hooks/use-alerts";
import { AlertConfigPopover } from "@/components/alert-config-popover";
import { WatchlistSummary } from "@/components/watchlist-summary";
import { BulkAlertDialog } from "@/components/bulk-alert-dialog";
import { getEarningsToday, getEarningsTomorrow, getEarningsNext30Days, getEarningsPrevious30Days, getEarnings, getEarningsWatchlist, getSectors } from "@/lib/api-client";
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

  // Sector filter state
  const [availableSectors, setAvailableSectors] = useState<string[]>([]);
  const [selectedSector, setSelectedSector] = useState<string>("all");

  // Filter earnings by selected sector (memoized for performance)
  const filteredEarnings = useMemo(() => {
    if (selectedSector === "all") {
      return earnings;
    }
    return earnings.filter(e => e.sector === selectedSector);
  }, [earnings, selectedSector]);

  // Watchlist functionality
  const watchlist = useWatchlist();
  
  // Alerts functionality
  const alerts = useAlerts();

  // Alert dialog state
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [alertSymbol, setAlertSymbol] = useState<string>("");
  const [alertEarningsData, setAlertEarningsData] = useState<EarningsData | null>(null);

  // Bulk alert dialog state
  const [bulkAlertDialogOpen, setBulkAlertDialogOpen] = useState(false);

  // API loading functions
  const loadEarningsData = useCallback(async (loadFn: () => Promise<EarningsResponse>, period: TimePeriod) => {
    setViewState("loading");
    setActivePeriod(period);
    setIsSearchMode(false);
    setIsWatchlistMode(false);
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
      // Normalize response: API returns array directly, not { earnings: [] }
      const earningsArray = Array.isArray(data) ? data : (data.earnings || []);

      // Find symbols without earnings data
      const symbolsWithEarnings = new Set(earningsArray.map((e) => e.symbol.toUpperCase()));
      const symbolsWithoutEarnings = watchedSymbols.filter(
        (s) => !symbolsWithEarnings.has(s.toUpperCase())
      );

      // Create placeholder entries for stocks without earnings data
      const placeholders: EarningsData[] = symbolsWithoutEarnings.map((symbol) => ({
        symbol: symbol.toUpperCase(),
        date: "",
        actual: null,
        estimate: null,
        surprise: null,
        surprisePercent: null,
        description: "No upcoming earnings data",
      }));

      // Merge earnings with placeholders (earnings first, then placeholders)
      const mergedEarnings = [...earningsArray, ...placeholders];

      setEarnings(mergedEarnings);
      setViewState(mergedEarnings.length > 0 ? "data" : "empty");

      const withData = earningsArray.length;
      const withoutData = placeholders.length;
      if (withoutData > 0) {
        toast.info(`Found ${withData} upcoming earnings. ${withoutData} stock${withoutData > 1 ? "s" : ""} without earnings date.`);
      } else {
        toast.info(`Found ${withData} upcoming earnings for your watchlist`);
      }
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
  const handleRowAction = useCallback(async (action: string, symbol: string) => {
    switch (action) {
      case "View Details": {
        toast.info(`Viewing details for ${symbol}`);
        break;
      }
      case "Set Alert": {
        const earning = filteredEarnings.find((e) => e.symbol === symbol);

        // Auto-add to watchlist if not already watchlisted (alerts are a subset of watchlist)
        if (!watchlist.isInWatchlist(symbol)) {
          const added = await watchlist.addToWatchlist(symbol);
          if (added) {
            toast.success(`${symbol} added to watchlist`);
          } else {
            // If we couldn't add to watchlist, don't proceed with alert
            return;
          }
        }

        setAlertSymbol(symbol);
        setAlertEarningsData(earning || null);
        setAlertDialogOpen(true);
        break;
      }
      case "View Chart": {
        // Look up exchange from earnings data
        const earning = filteredEarnings.find((e) => e.symbol === symbol);
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
  }, [filteredEarnings, watchlist]);

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

  // Load available sectors on mount
  useEffect(() => {
    const fetchSectors = async () => {
      try {
        const data = await getSectors();
        if (data.sectors && data.sectors.length > 0) {
          setAvailableSectors(data.sectors);
        }
      } catch (err) {
        logger.error("Failed to fetch sectors:", err);
        // Fallback sectors if API fails
        setAvailableSectors(["Technology"]);
      }
    };
    fetchSectors();
  }, []);

  // Load initial data
  useEffect(() => {
    loadToday();
  }, [loadToday]);

  // Get description text based on current state
  const getDescriptionText = () => {
    if (isWatchlistMode) {
      return `Your watchlist: ${watchlist.count} stocks tracked. Click the bookmark icon to return to the earnings calendar.`;
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
            
            {/* Hide navigation in watchlist mode - show all upcoming for watched stocks */}
            {!isWatchlistMode && (
              <NavigationButtons
                activeButton={activePeriod}
                onButtonClick={handleNavigationClick}
                loading={viewState === "loading"}
              />
            )}

            {/* Sector filter - show when not in search or watchlist mode */}
            {!isWatchlistMode && !isSearchMode && availableSectors.length > 1 && (
              <div className="flex items-center gap-2 mt-4">
                <label htmlFor="sector-filter" className="text-sm text-muted-foreground">
                  Filter by sector:
                </label>
                <select
                  id="sector-filter"
                  value={selectedSector}
                  onChange={(e) => setSelectedSector(e.target.value)}
                  className="px-3 py-1.5 text-sm border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="all">All Sectors</option>
                  {availableSectors.map((sector) => (
                    <option key={sector} value={sector}>
                      {sector}
                    </option>
                  ))}
                </select>
                {selectedSector !== "all" && (
                  <span className="text-xs text-muted-foreground">
                    Showing {filteredEarnings.length} of {earnings.length} results
                  </span>
                )}
              </div>
            )}
          </section>

          {/* Watchlist Summary (only in watchlist mode) */}
          {isWatchlistMode && (
            <WatchlistSummary
              watchlistCount={watchlist.count}
              earnings={earnings}
              alerts={alerts.alerts}
              onBulkAlertClick={() => setBulkAlertDialogOpen(true)}
            />
          )}

          {/* Hide filters in watchlist mode - they don't apply */}
          {!isWatchlistMode && (
            <SearchFilters
              filters={searchFilters}
              onFiltersChange={setSearchFilters}
              onSearch={handleSearch}
              loading={viewState === "loading"}
            />
          )}
          
          <EarningsTable
            data={filteredEarnings}
            loading={viewState === "loading"}
            error={error}
            onRowAction={handleRowAction}
            watchlistedItems={watchlistedItems}
            onToggleWatchlist={handleWatchlistToggle}
            alertedItems={alertedItems}
            alerts={alerts.alerts}
            isWatchlistMode={isWatchlistMode}
            onAlertClick={(symbol, earningsData) => {
              setAlertSymbol(symbol);
              setAlertEarningsData(earningsData);
              setAlertDialogOpen(true);
            }}
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

      <AlertConfigPopover
        open={alertDialogOpen}
        onOpenChange={setAlertDialogOpen}
        symbol={alertSymbol}
        earningsData={alertEarningsData}
        existingAlerts={alerts.alerts}
        onSuccess={() => {
          // Refresh alerts state
          alerts.refresh();
        }}
      />

      <BulkAlertDialog
        open={bulkAlertDialogOpen}
        onOpenChange={setBulkAlertDialogOpen}
        earnings={earnings}
        existingAlerts={alerts.alerts}
        onSuccess={() => {
          alerts.refresh();
        }}
      />
    </div>
  );
}
