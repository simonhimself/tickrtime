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
export type SortField = "symbol" | "exchange" | "date" | "estimate" | "actual" | "surprise" | "surprisePercent" | "year" | "quarter" | "hour" | "description";
export type SortDirection = "asc" | "desc" | null;
export type TimePeriod = "next30" | "previous30" | "today" | "tomorrow" | "search" | "watchlist";

// Table sorting state
export interface SortState {
  field: SortField | null;
  direction: SortDirection;
}

// Error types
export interface ApiError {
  message: string;
  status?: number;
  code?: string;
}

// Authentication types
export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthRequest {
  email: string;
  password: string;
}

export interface SignupRequest extends AuthRequest {
  confirmPassword: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: User;
  token?: string;
}

export interface WatchlistApiResponse {
  success: boolean;
  message: string;
  watchlist?: WatchlistState;
  tickers?: string[];
}


