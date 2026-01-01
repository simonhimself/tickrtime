"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { logger } from "@/lib/logger";
import { Header } from "@/components/header";
import { FilterTabs, type FilterTab } from "@/components/filter-tabs";
import { BrowseFilters } from "@/components/browse-filters";
import { SearchFilters } from "@/components/search-filters";
import { EarningsTable } from "@/components/earnings-table";
import { useWatchlist } from "@/hooks/use-watchlist";
import { useAlerts } from "@/hooks/use-alerts";
import { AlertConfigPopover } from "@/components/alert-config-popover";
import { WatchlistSummary } from "@/components/watchlist-summary";
import { BulkAlertDialog } from "@/components/bulk-alert-dialog";
import { getEarningsToday, getEarningsTomorrow, getEarningsNext30Days, getEarningsPrevious30Days, getEarnings, getEarningsWatchlist, getSectors, getIndustries, deleteAlertsBySymbol } from "@/lib/api-client";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
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
    year: String(new Date().getFullYear()),
    quarter: "all",
  });
  const [hasSearched, setHasSearched] = useState(false);

  // Tab state (Browse vs Search mode)
  const [activeTab, setActiveTab] = useState<FilterTab>("browse");

  // Sector and Industry filter state
  const [availableSectors, setAvailableSectors] = useState<string[]>([]);
  const [selectedSector, setSelectedSector] = useState<string>("all");
  const [availableIndustries, setAvailableIndustries] = useState<string[]>([]);
  const [selectedIndustry, setSelectedIndustry] = useState<string>("all");

  // Filter earnings by selected sector and industry (memoized for performance)
  const filteredEarnings = useMemo(() => {
    let result = earnings;

    if (selectedSector !== "all") {
      result = result.filter(e => e.sector === selectedSector);
    }

    if (selectedIndustry !== "all") {
      result = result.filter(e => e.industry === selectedIndustry);
    }

    return result;
  }, [earnings, selectedSector, selectedIndustry]);

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

  // Remove from watchlist confirmation dialog state (when ticker has alerts)
  const [removeConfirm, setRemoveConfirm] = useState<{
    symbol: string;
    alertCount: number;
  } | null>(null);

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

    setHasSearched(true);
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

    // If removing from watchlist and has alerts, show confirmation dialog
    if (wasInWatchlist) {
      const symbolAlerts = alerts.getAlertsForSymbol(symbol);
      if (symbolAlerts.length > 0) {
        setRemoveConfirm({ symbol, alertCount: symbolAlerts.length });
        return false; // Don't remove yet, wait for confirmation
      }
    }

    const success = await watchlist.toggleWatchlist(symbol);

    if (success) {
      if (wasInWatchlist) {
        toast.info(`${symbol} removed from watchlist`);
      } else {
        toast.success(`${symbol} added to watchlist`);
      }
    }

    return success;
  }, [watchlist, alerts]);

  const handleConfirmRemove = useCallback(async () => {
    if (!removeConfirm) return;

    const { symbol } = removeConfirm;

    // Delete alerts first
    const alertResult = await deleteAlertsBySymbol(symbol);

    if (!alertResult.success) {
      toast.error(`Failed to delete alerts for ${symbol}. Please try again.`);
      setRemoveConfirm(null);
      return;
    }

    // Then remove from watchlist
    const success = await watchlist.toggleWatchlist(symbol);

    if (success) {
      toast.info(`${symbol} removed from watchlist and ${removeConfirm.alertCount} alert(s) deleted`);
      // Trigger alerts refresh
      window.dispatchEvent(new CustomEvent('alertsChanged'));
    }

    setRemoveConfirm(null);
  }, [removeConfirm, watchlist]);

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

  // Fetch industries when sector changes (hierarchical filtering)
  useEffect(() => {
    if (selectedSector === "all") {
      setAvailableIndustries([]);
      setSelectedIndustry("all");
      return;
    }

    const fetchIndustries = async () => {
      try {
        const data = await getIndustries(selectedSector);
        if (data.industries && data.industries.length > 0) {
          setAvailableIndustries(data.industries);
        } else {
          setAvailableIndustries([]);
        }
      } catch (err) {
        logger.error("Failed to fetch industries:", err);
        setAvailableIndustries([]);
      }
    };
    fetchIndustries();
  }, [selectedSector]);

  // Handle sector change - reset industry when sector changes
  const handleSectorChange = useCallback((sector: string) => {
    setSelectedSector(sector);
    setSelectedIndustry("all"); // Reset industry when sector changes
  }, []);

  // Handle tab change
  const handleTabChange = useCallback((tab: FilterTab) => {
    setActiveTab(tab);

    if (tab === "browse") {
      setHasSearched(false);
      // When switching to Browse from Search mode, reload today's data
      if (isSearchMode) {
        loadToday();
      }
    } else if (tab === "search") {
      setHasSearched(false);
    }
  }, [isSearchMode, loadToday]);

  // Load initial data
  useEffect(() => {
    loadToday();
  }, [loadToday]);

  // Get description text based on current state
  const getDescriptionText = () => {
    if (isWatchlistMode) {
      return `Your watchlist: ${watchlist.count} stocks tracked. Click the bookmark icon to return to the earnings calendar.`;
    }

    // Simple static description - the tabs are self-explanatory
    return "Track earnings announcements across 8,000+ US stocks.";
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
            
            {/* Tab-based filter UI - hide in watchlist mode */}
            {!isWatchlistMode && (
              <>
                <FilterTabs
                  activeTab={activeTab}
                  onTabChange={handleTabChange}
                  className="mb-4"
                />

                {activeTab === "browse" ? (
                  <BrowseFilters
                    activePeriod={activePeriod}
                    onPeriodChange={handleNavigationClick}
                    selectedSector={selectedSector}
                    onSectorChange={handleSectorChange}
                    selectedIndustry={selectedIndustry}
                    onIndustryChange={setSelectedIndustry}
                    availableSectors={availableSectors}
                    availableIndustries={availableIndustries}
                    resultCount={{ filtered: filteredEarnings.length, total: earnings.length }}
                    loading={viewState === "loading"}
                  />
                ) : (
                  <SearchFilters
                    filters={searchFilters}
                    onFiltersChange={setSearchFilters}
                    onSearch={handleSearch}
                    loading={viewState === "loading"}
                  />
                )}
              </>
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

          {activeTab === "search" && !hasSearched ? (
            <div className="bg-card rounded-lg shadow-sm border border-border p-12 text-center">
              <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                Enter a ticker symbol above to search historical earnings.
              </p>
            </div>
          ) : (
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
          )}
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

      {/* Confirmation dialog for removing ticker with alerts */}
      <AlertDialog open={!!removeConfirm} onOpenChange={(open) => !open && setRemoveConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removeConfirm?.symbol} from Watchlist?</AlertDialogTitle>
            <AlertDialogDescription>
              This ticker has {removeConfirm?.alertCount} active alert{removeConfirm?.alertCount === 1 ? '' : 's'}.
              Removing from watchlist will also delete {removeConfirm?.alertCount === 1 ? 'this alert' : 'these alerts'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRemove}>
              Remove & Delete Alerts
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
