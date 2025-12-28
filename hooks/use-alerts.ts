"use client";

import { useState, useEffect, useCallback } from "react";

import type { KVAlert } from "@/lib/auth";
import type { UseAlertsReturn } from "@/types";
import { getAlerts } from "@/lib/api-client";

export function useAlerts(): UseAlertsReturn {
  const [alerts, setAlerts] = useState<KVAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get auth token from localStorage
  const getAuthToken = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('tickrtime-auth-token');
  };

  // Load alerts from API on mount and when auth token changes
  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      loadAlerts();
    } else {
      // Clear alerts when no token
      setAlerts([]);
    }
  }, []); // Remove loadAlerts dependency to avoid circular dependency

  // Listen for authentication state changes
  useEffect(() => {
    const handleAuthChange = (event: CustomEvent) => {
      if (event.detail.action === 'login') {
        // User logged in, reload alerts
        loadAlerts();
      } else if (event.detail.action === 'logout') {
        // User logged out, clear alerts
        setAlerts([]);
      }
    };

    window.addEventListener('authStateChanged', handleAuthChange as EventListener);
    
    return () => {
      window.removeEventListener('authStateChanged', handleAuthChange as EventListener);
    };
  }, []); // Remove loadAlerts dependency to avoid circular dependency

  // Listen for alert changes (created/deleted/updated)
  useEffect(() => {
    const handleAlertChange = () => {
      loadAlerts();
    };

    window.addEventListener('alertsChanged', handleAlertChange as EventListener);
    
    return () => {
      window.removeEventListener('alertsChanged', handleAlertChange as EventListener);
    };
  }, []);

  // Load alerts from API
  const loadAlerts = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const data = await getAlerts();
      if (data.success && data.alerts) {
        setAlerts(data.alerts);
      } else {
        setAlerts([]);
      }
    } catch (err: any) {
      console.error("Failed to load alerts:", err);
      setError(err.message || "Failed to load alerts");
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Get all symbols with active alerts
  const getAlertedSymbols = useCallback(() => {
    const activeAlerts = alerts.filter(a => a.status === 'active');
    const symbols = activeAlerts.map(a => a.symbol.toUpperCase());
    // Return unique symbols
    return Array.from(new Set(symbols));
  }, [alerts]);

  // Check if symbol has an active alert
  const hasAlert = useCallback((symbol: string) => {
    const normalizedSymbol = symbol.toUpperCase();
    return alerts.some(
      a => a.symbol.toUpperCase() === normalizedSymbol && a.status === 'active'
    );
  }, [alerts]);

  // Get all active alerts for a specific symbol
  const getAlertsForSymbol = useCallback((symbol: string) => {
    const normalizedSymbol = symbol.toUpperCase();
    return alerts.filter(
      a => a.symbol.toUpperCase() === normalizedSymbol && a.status === 'active'
    );
  }, [alerts]);

  // Get active alerts count
  const activeCount = alerts.filter(a => a.status === 'active').length;

  return {
    alerts,
    getAlertedSymbols,
    getAlertsForSymbol,
    hasAlert,
    count: activeCount,
    loading,
    error,
    refresh: loadAlerts,
  };
}





