/**
 * Core data types for the TickrTime application
 */

// Earnings data from API
export interface EarningsData {
  symbol: string;
  date: string;
  actual: number | null;
  estimate: number | null;
  surprise: number | null;
  surprisePercent: number | null;
  hour?: string;
  quarter?: number;
  year?: number;
  exchange?: string;
  description?: string;
}

// API response wrapper
export interface EarningsResponse {
  earnings: EarningsData[];
  date?: string;
  totalFound?: number;
  error?: string;
}

// Stock data for display (legacy compatibility)
export interface StockData {
  id: string;
  ticker: string;
  exchange: string;
  earningsDate: string;
  dateLabel: string;
  estimate: string;
  eps: string;
  surprise: string;
  surpriseColor: "positive" | "negative" | "neutral";
}

// Tech ticker data
export interface TechTicker {
  symbol: string;
  description: string;
  exchange: string;
  finnhubIndustry: string;
}

// Watchlist types
export interface WatchlistItem {
  symbol: string;
  addedAt: string;
}

export interface WatchlistState {
  tickers: WatchlistItem[];
  lastUpdated: string;
}

// Search filters
export interface SearchFilters {
  ticker: string;
  year: string;
  quarter: string;
}

// UI state types
export type ViewState = "loading" | "data" | "error" | "empty";
export type SortField = "symbol" | "exchange" | "date" | "estimate" | "actual" | "surprisePercent";
export type SortDirection = "asc" | "desc" | null;
export type TimePeriod = "next30" | "previous30" | "today" | "tomorrow" | "search" | "watchlist";

// Table sorting state
export interface SortState {
  field: SortField | null;
  direction: SortDirection;
}

// Action icon configuration
export interface ActionIcon {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  colorClass: string;
  onClick: (symbol: string) => void;
}

// Navigation button configuration
export interface NavigationButton {
  id: TimePeriod;
  label: string;
  description?: string;
}

// Error types
export interface ApiError {
  message: string;
  status?: number;
  code?: string;
}

// Environment variables (for type safety)
export interface Env {
  FINNHUB_API_KEY: string;
  NODE_ENV: "development" | "production" | "test";
}

// Component prop types
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface TableProps extends BaseComponentProps {
  data: EarningsData[];
  loading?: boolean;
  error?: string | null;
  onRowAction?: (action: string, symbol: string) => void;
  watchlistedItems?: Set<string>;
  onToggleWatchlist?: (symbol: string) => boolean;
  sortState?: SortState;
  onSort?: (field: SortField) => void;
}

export interface HeaderProps extends BaseComponentProps {
  watchlistCount: number;
  onWatchlistClick: () => void;
  onUserAction: (action: string) => void;
}

export interface SearchFiltersProps extends BaseComponentProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onSearch: () => void;
  loading?: boolean;
}

export interface NavigationButtonsProps extends BaseComponentProps {
  activeButton: TimePeriod;
  onButtonClick: (buttonId: TimePeriod) => void;
  loading?: boolean;
}

// Hook return types
export interface UseWatchlistReturn {
  watchlist: WatchlistState;
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  isInWatchlist: (symbol: string) => boolean;
  toggleWatchlist: (symbol: string) => void;
  getWatchedSymbols: () => string[];
  count: number;
}

export interface UseTableSortReturn {
  sortedData: EarningsData[];
  sortState: SortState;
  handleSort: (field: SortField) => void;
  getSortIcon: (field: SortField) => "asc" | "desc" | null;
  isSortable: (field: SortField) => boolean;
}

export interface UseTableHoverReturn {
  hoveredRow: string | null;
  iconPosition: number;
  rowRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  tableHeaderRef: React.RefObject<HTMLDivElement>;
  handleRowHover: (symbol: string) => void;
  handleHoverEnd: () => void;
  handleIconAreaHover: () => void;
  handleIconAreaLeave: () => void;
  shouldShowIcons: boolean;
  ICON_VERTICAL_OFFSET: number;
}
