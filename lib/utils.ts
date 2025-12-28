import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS classes with proper conflict resolution
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as currency
 */
export function formatCurrency(
  value: number | null | undefined,
  options: {
    currency?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  } = {}
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return "-";
  }

  const { currency = "USD", minimumFractionDigits = 2, maximumFractionDigits = 2 } = options;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value);
}

/**
 * Format a percentage value
 */
export function formatPercentage(
  value: number | null | undefined,
  options: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    showSign?: boolean;
  } = {}
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return "-";
  }

  const { minimumFractionDigits = 1, maximumFractionDigits = 1, showSign = true } = options;

  const formatted = new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits,
    maximumFractionDigits,
    signDisplay: showSign ? "exceptZero" : "auto",
  }).format(value / 100);

  return formatted;
}

/**
 * Format a date relative to today, with optional timezone conversion
 */
export function formatRelativeDate(
  dateString: string,
  timezone?: string
): { formattedDate: string; relativeText: string } {
  // Parse the date string - API returns dates in YYYY-MM-DD format (UTC)
  const date = new Date(dateString);

  // Get today in the target timezone (or local timezone if not specified)
  const now = new Date();

  // Format the date in the target timezone
  const formatOptions: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    ...(timezone ? { timeZone: timezone } : {})
  };

  const formattedDate = date.toLocaleDateString("en-US", formatOptions);

  // Get date strings in the target timezone for comparison
  const todayStr = now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(timezone ? { timeZone: timezone } : {})
  });

  const dateStr = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(timezone ? { timeZone: timezone } : {})
  });

  // Calculate tomorrow in target timezone
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(timezone ? { timeZone: timezone } : {})
  });

  const isToday = dateStr === todayStr;
  const isTomorrow = dateStr === tomorrowStr;

  let relativeText = "";
  if (isToday) {
    relativeText = "Today";
  } else if (isTomorrow) {
    relativeText = "Tomorrow";
  } else {
    // Calculate days difference using timezone-aware dates
    const todayMidnight = new Date(todayStr);
    const dateMidnight = new Date(dateStr);
    const diffTime = dateMidnight.getTime() - todayMidnight.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      relativeText = `In ${diffDays} day${diffDays > 1 ? "s" : ""}`;
    } else {
      const absDays = Math.abs(diffDays);
      relativeText = `${absDays} day${absDays > 1 ? "s" : ""} ago`;
    }
  }

  return { formattedDate, relativeText };
}

/**
 * Get color class for surprise percentage
 */
export function getSurpriseColorClass(surprise: number | null | undefined): string {
  if (surprise === null || surprise === undefined || isNaN(surprise)) {
    return "text-muted-foreground";
  }
  
  if (surprise > 0) {
    return "text-green-600 dark:text-green-400";
  } else if (surprise < 0) {
    return "text-red-600 dark:text-red-400";
  } else {
    return "text-muted-foreground";
  }
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function for performance optimization
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Extract clean company name from description
 * Removes corporate suffixes like "INC", "CORP", "PLC", "-CL A", "LTD-CL A", etc.
 */
export function extractCompanyName(description: string | null | undefined): string {
  if (!description) {
    return "-";
  }

  const name = description
    // Remove patterns like "LTD-CL A", "PLC-CL A", "INC-CL A" etc.
    .replace(/\s*-\s*(CL|CLASS)\s*[A-Z]\s*$/gi, "")
    // Remove corporate suffixes with optional class designations: "INC", "CORP", "PLC", "LTD-CL A", etc.
    .replace(/\s+(INC|CORP|CORPORATION|PLC|LTD|LIMITED|LLC|CO|COMPANY|HOLDINGS|HLDGS|HLDG)\s*(-?\s*(CL|CLASS)?\s*[A-Z])?\s*$/gi, "")
    // Remove standalone class designations: "-CL A", "-CLASS A", "-A"
    .replace(/\s*-\s*(CL|CLASS)?\s*[A-Z]\s*$/gi, "")
    // Remove "-ADR"
    .replace(/\s*-\s*ADR\s*$/gi, "")
    // Remove "GROUP HOLDING" or "HOLDING" at the end
    .replace(/\s+(GROUP\s+)?HOLDING(S)?\s*$/gi, "")
    // Remove any trailing dashes or spaces
    .replace(/\s*-\s*$/, "")
    .replace(/\s+$/, "")
    .trim();

  return name || description;
}

/**
 * Sleep function for async operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Safe JSON parse with fallback
 */
export function safeParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

/**
 * Check if a value is not null or undefined
 */
export function isNotNullish<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}
