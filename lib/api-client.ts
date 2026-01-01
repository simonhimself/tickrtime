/**
 * Centralized API Client for TickrTime
 *
 * This client handles all API calls to the Cloudflare Worker API.
 * In development, it points to localhost:8787, in production to the deployed Worker.
 */

import type { User, AuthResponse, EarningsResponse, WatchlistApiResponse } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

// API Response types
interface GetMeResponse {
  user: User | null;
  error?: string;
}

interface NotificationPreferences {
  emailEnabled: boolean;
  defaultDaysBefore: number;
  defaultDaysAfter: number;
}

interface GetAlertPreferencesResponse {
  success: boolean;
  preferences: NotificationPreferences | null;
  error?: string;
}

interface ApiResponse {
  success: boolean;
  message?: string;
  error?: string;
}

interface Alert {
  id: string;
  userId: string;
  symbol: string;
  alertType: 'before' | 'after';
  daysBefore?: number;
  daysAfter?: number;
  recurring: boolean;
  earningsDate: string;
  status: 'active' | 'sent' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

interface CreateAlertResponse extends ApiResponse {
  alert?: Alert;
}

interface GetAlertsResponse extends ApiResponse {
  alerts?: Alert[];
}

// Helper to get auth token
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tickrtime-auth-token');
}

// Helper to make authenticated requests
async function authenticatedFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(options.headers);
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  headers.set('Content-Type', 'application/json');
  
  return fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });
}

// Auth API
export async function signup(data: { email: string; password: string; confirmPassword: string }): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function login(data: { email: string; password: string }): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function getMe(): Promise<GetMeResponse> {
  return authenticatedFetch('/api/auth/me').then(res => res.json());
}

export async function verifyEmail(token: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
    method: 'GET',
  });
  return res.json();
}

// Alerts API
export async function getAlerts(): Promise<GetAlertsResponse> {
  return authenticatedFetch('/api/alerts').then(res => res.json());
}

export async function createAlert(data: {
  symbol: string;
  alertType: 'before' | 'after';
  daysBefore?: number;
  daysAfter?: number;
  recurring: boolean;
  earningsDate: string;
}): Promise<CreateAlertResponse> {
  return authenticatedFetch('/api/alerts', {
    method: 'POST',
    body: JSON.stringify(data),
  }).then(res => res.json());
}

export async function getAlert(id: string): Promise<CreateAlertResponse> {
  return authenticatedFetch(`/api/alerts/${id}`).then(res => res.json());
}

export async function updateAlert(id: string, data: {
  daysBefore?: number;
  daysAfter?: number;
  recurring?: boolean;
  earningsDate?: string;
  status?: 'active' | 'sent' | 'cancelled';
}): Promise<ApiResponse> {
  return authenticatedFetch(`/api/alerts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }).then(res => res.json());
}

export async function deleteAlert(id: string): Promise<ApiResponse> {
  return authenticatedFetch(`/api/alerts/${id}`, {
    method: 'DELETE',
  }).then(res => res.json());
}

export async function deleteAlertsBySymbol(symbol: string): Promise<ApiResponse & { deleted?: number }> {
  return authenticatedFetch(`/api/alerts/symbol/${encodeURIComponent(symbol)}`, {
    method: 'DELETE',
  }).then(res => res.json());
}

export async function getAlertPreferences(): Promise<GetAlertPreferencesResponse> {
  return authenticatedFetch('/api/alerts/preferences').then(res => res.json());
}

export async function updateAlertPreferences(data: {
  emailEnabled?: boolean;
  defaultDaysBefore?: number;
  defaultDaysAfter?: number;
}): Promise<ApiResponse> {
  return authenticatedFetch('/api/alerts/preferences', {
    method: 'PUT',
    body: JSON.stringify(data),
  }).then(res => res.json());
}

// Earnings API
export async function getEarnings(params?: { symbol?: string; year?: string; quarter?: string }): Promise<EarningsResponse> {
  const queryParams = new URLSearchParams();
  if (params?.symbol) queryParams.set('symbol', params.symbol);
  if (params?.year) queryParams.set('year', params.year);
  if (params?.quarter) queryParams.set('quarter', params.quarter);

  const query = queryParams.toString();
  const url = `${API_BASE}/api/earnings${query ? `?${query}` : ''}`;
  const res = await fetch(url);
  return res.json();
}

export async function getEarningsToday(): Promise<EarningsResponse> {
  const res = await fetch(`${API_BASE}/api/earnings-today`);
  return res.json();
}

export async function getEarningsTomorrow(): Promise<EarningsResponse> {
  const res = await fetch(`${API_BASE}/api/earnings-tomorrow`);
  return res.json();
}

export async function getEarningsNext30Days(): Promise<EarningsResponse> {
  const res = await fetch(`${API_BASE}/api/earnings-next-30-days`);
  return res.json();
}

export async function getEarningsPrevious30Days(): Promise<EarningsResponse> {
  const res = await fetch(`${API_BASE}/api/earnings-previous-30-days`);
  return res.json();
}

export async function getEarningsWatchlist(symbols: string[]): Promise<EarningsResponse> {
  const symbolsParam = symbols.join(',');
  const res = await fetch(`${API_BASE}/api/earnings-watchlist?symbols=${encodeURIComponent(symbolsParam)}`);
  return res.json();
}

// Watchlist API
export async function getWatchlist(): Promise<WatchlistApiResponse> {
  return authenticatedFetch('/api/watchlist').then(res => res.json());
}

export async function addToWatchlist(symbol: string): Promise<WatchlistApiResponse> {
  return authenticatedFetch('/api/watchlist', {
    method: 'POST',
    body: JSON.stringify({ symbol }),
  }).then(res => res.json());
}

export async function removeFromWatchlist(symbol: string): Promise<WatchlistApiResponse> {
  return authenticatedFetch(`/api/watchlist?symbol=${encodeURIComponent(symbol)}`, {
    method: 'DELETE',
  }).then(res => res.json());
}

// Tickers API
interface TickerData {
  symbol: string;
  description?: string;
  exchange: string;
  industry?: string;
  sector?: string;
  isActive?: boolean;
  profileFetchedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface TickersListResponse {
  tickers: TickerData[];
  total: number;
  limit: number;
  offset: number;
  message?: string;
  error?: string;
}

interface SectorsResponse {
  sectors: string[];
  error?: string;
}

interface IndustriesResponse {
  industries: string[];
  error?: string;
}

interface TickerResponse extends TickerData {
  error?: string;
}

export async function getTickers(params?: {
  sector?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<TickersListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.sector) queryParams.set('sector', params.sector);
  if (params?.search) queryParams.set('search', params.search);
  if (params?.limit) queryParams.set('limit', String(params.limit));
  if (params?.offset) queryParams.set('offset', String(params.offset));

  const query = queryParams.toString();
  const url = `${API_BASE}/api/tickers${query ? `?${query}` : ''}`;
  const res = await fetch(url);
  return res.json();
}

export async function getSectors(): Promise<SectorsResponse> {
  const res = await fetch(`${API_BASE}/api/tickers/sectors`);
  return res.json();
}

export async function getIndustries(sector?: string): Promise<IndustriesResponse> {
  const queryParams = new URLSearchParams();
  if (sector) queryParams.set('sector', sector);

  const query = queryParams.toString();
  const url = `${API_BASE}/api/tickers/industries${query ? `?${query}` : ''}`;
  const res = await fetch(url);
  return res.json();
}

export async function getTicker(symbol: string): Promise<TickerResponse> {
  const res = await fetch(`${API_BASE}/api/tickers/${encodeURIComponent(symbol)}`);
  return res.json();
}

