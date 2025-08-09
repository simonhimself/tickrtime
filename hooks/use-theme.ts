"use client";

import { useTheme as useNextTheme } from "next-themes";

export function useTheme() {
  const { theme, setTheme, systemTheme } = useNextTheme();
  
  // Get the actual theme being used (resolve 'system' to actual theme)
  const resolvedTheme = theme === "system" ? systemTheme : theme;
  const isDarkMode = resolvedTheme === "dark";
  
  const toggleDarkMode = () => {
    setTheme(isDarkMode ? "light" : "dark");
  };

  const setLightMode = () => setTheme("light");
  const setDarkMode = () => setTheme("dark");
  const setSystemMode = () => setTheme("system");

  return {
    theme,
    resolvedTheme,
    isDarkMode,
    toggleDarkMode,
    setLightMode,
    setDarkMode,
    setSystemMode,
    setTheme,
  };
}
