"use client";

import { useState, useEffect, useCallback } from "react";

export interface DisplayPreferences {
  displayName: string;
  defaultPeriod: string;
  timezone: string;
  showEstimates: boolean;
  showSurprises: boolean;
  showExchange: boolean;
}

const DEFAULT_PREFERENCES: DisplayPreferences = {
  displayName: "",
  defaultPeriod: "today",
  timezone: "America/New_York",
  showEstimates: true,
  showSurprises: true,
  showExchange: true,
};

export interface UsePreferencesReturn {
  preferences: DisplayPreferences;
  loading: boolean;
  updatePreferences: (updates: Partial<DisplayPreferences>) => void;
}

export function usePreferences(): UsePreferencesReturn {
  const [preferences, setPreferences] = useState<DisplayPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);

  // Load preferences from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") {
      setLoading(false);
      return;
    }

    try {
      const savedPrefs = localStorage.getItem("tickrtime-preferences");
      if (savedPrefs) {
        const parsed = JSON.parse(savedPrefs);
        setPreferences({
          displayName: parsed.displayName ?? DEFAULT_PREFERENCES.displayName,
          defaultPeriod: parsed.defaultPeriod ?? DEFAULT_PREFERENCES.defaultPeriod,
          timezone: parsed.timezone ?? DEFAULT_PREFERENCES.timezone,
          showEstimates: parsed.showEstimates ?? DEFAULT_PREFERENCES.showEstimates,
          showSurprises: parsed.showSurprises ?? DEFAULT_PREFERENCES.showSurprises,
          showExchange: parsed.showExchange ?? DEFAULT_PREFERENCES.showExchange,
        });
      }
    } catch (error) {
      console.error("Failed to load preferences:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Listen for preferences changes (e.g., from profile page)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === "tickrtime-preferences" && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          setPreferences({
            displayName: parsed.displayName ?? DEFAULT_PREFERENCES.displayName,
            defaultPeriod: parsed.defaultPeriod ?? DEFAULT_PREFERENCES.defaultPeriod,
            timezone: parsed.timezone ?? DEFAULT_PREFERENCES.timezone,
            showEstimates: parsed.showEstimates ?? DEFAULT_PREFERENCES.showEstimates,
            showSurprises: parsed.showSurprises ?? DEFAULT_PREFERENCES.showSurprises,
            showExchange: parsed.showExchange ?? DEFAULT_PREFERENCES.showExchange,
          });
        } catch (error) {
          console.error("Failed to parse preferences from storage event:", error);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const updatePreferences = useCallback((updates: Partial<DisplayPreferences>) => {
    setPreferences((prev) => {
      const newPrefs = { ...prev, ...updates };
      if (typeof window !== "undefined") {
        localStorage.setItem("tickrtime-preferences", JSON.stringify(newPrefs));
      }
      return newPrefs;
    });
  }, []);

  return {
    preferences,
    loading,
    updatePreferences,
  };
}
