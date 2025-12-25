/**
 * Centralized API Client for TickrTime
 * 
 * This client handles all API calls to the Cloudflare Worker API.
 * In development, it points to localhost:8787, in production to the deployed Worker.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

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
export async function signup(data: { email: string; password: string; confirmPassword: string }) {
  const res = await fetch(`${API_BASE}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function login(data: { email: string; password: string }) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function getMe() {
  return authenticatedFetch('/api/auth/me').then(res => res.json());
}

export async function verifyEmail(token: string) {
  const res = await fetch(`${API_BASE}/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
    method: 'GET',
  });
  return res.json();
}

// Alerts API
export async function getAlerts() {
  return authenticatedFetch('/api/alerts').then(res => res.json());
}

export async function createAlert(data: {
  symbol: string;
  alertType: 'before' | 'after';
  daysBefore?: number;
  daysAfter?: number;
  recurring: boolean;
  earningsDate: string;
}) {
  return authenticatedFetch('/api/alerts', {
    method: 'POST',
    body: JSON.stringify(data),
  }).then(res => res.json());
}

export async function getAlert(id: string) {
  return authenticatedFetch(`/api/alerts/${id}`).then(res => res.json());
}

export async function updateAlert(id: string, data: {
  daysBefore?: number;
  daysAfter?: number;
  recurring?: boolean;
  earningsDate?: string;
  status?: 'active' | 'sent' | 'cancelled';
}) {
  return authenticatedFetch(`/api/alerts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }).then(res => res.json());
}

export async function deleteAlert(id: string) {
  return authenticatedFetch(`/api/alerts/${id}`, {
    method: 'DELETE',
  }).then(res => res.json());
}

export async function getAlertPreferences() {
  return authenticatedFetch('/api/alerts/preferences').then(res => res.json());
}

export async function updateAlertPreferences(data: {
  emailEnabled?: boolean;
  defaultDaysBefore?: number;
  defaultDaysAfter?: number;
}) {
  return authenticatedFetch('/api/alerts/preferences', {
    method: 'PUT',
    body: JSON.stringify(data),
  }).then(res => res.json());
}

// Earnings API
export async function getEarnings(params?: { symbol?: string; year?: string; quarter?: string }) {
  const queryParams = new URLSearchParams();
  if (params?.symbol) queryParams.set('symbol', params.symbol);
  if (params?.year) queryParams.set('year', params.year);
  if (params?.quarter) queryParams.set('quarter', params.quarter);
  
  const query = queryParams.toString();
  const url = `${API_BASE}/api/earnings${query ? `?${query}` : ''}`;
  const res = await fetch(url);
  return res.json();
}

export async function getEarningsToday() {
  const res = await fetch(`${API_BASE}/api/earnings-today`);
  return res.json();
}

export async function getEarningsTomorrow() {
  const res = await fetch(`${API_BASE}/api/earnings-tomorrow`);
  return res.json();
}

export async function getEarningsNext30Days() {
  const res = await fetch(`${API_BASE}/api/earnings-next-30-days`);
  return res.json();
}

export async function getEarningsPrevious30Days() {
  const res = await fetch(`${API_BASE}/api/earnings-previous-30-days`);
  return res.json();
}

export async function getEarningsWatchlist(symbols: string[]) {
  const symbolsParam = symbols.join(',');
  const res = await fetch(`${API_BASE}/api/earnings-watchlist?symbols=${encodeURIComponent(symbolsParam)}`);
  return res.json();
}

// Watchlist API
export async function getWatchlist() {
  return authenticatedFetch('/api/watchlist').then(res => res.json());
}

export async function addToWatchlist(symbol: string) {
  return authenticatedFetch('/api/watchlist', {
    method: 'POST',
    body: JSON.stringify({ symbol }),
  }).then(res => res.json());
}

export async function removeFromWatchlist(symbol: string) {
  return authenticatedFetch(`/api/watchlist?symbol=${encodeURIComponent(symbol)}`, {
    method: 'DELETE',
  }).then(res => res.json());
}

