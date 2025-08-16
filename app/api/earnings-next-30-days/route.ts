import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logger } from '@/lib/logger';

import techTickers from "@/data/tech_tickers.json";
import type { EarningsResponse } from "@/types";

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";

export const runtime = "edge"; // Cloudflare Pages Edge Runtime compatibility

export async function GET(_req: NextRequest) {
  try {
    if (!FINNHUB_API_KEY) {
      logger.error("[API] FINNHUB_API_KEY environment variable is not set");
      return NextResponse.json(
        { error: "API configuration error" },
        { status: 500 }
      );
    }

    // Use imported tech tickers for filtering
    const techSymbols = new Set(techTickers.map((t) => t.symbol));
    
    // Calculate next 30 days
    const today = new Date();
    const fromDate = today.toISOString().split("T")[0]!; // Today in YYYY-MM-DD format
    
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    const toDate = thirtyDaysFromNow.toISOString().split("T")[0]!; // 30 days from now
    
    logger.debug("[API] /api/earnings-next-30-days date range:", { fromDate, toDate });

    // WORKAROUND: Finnhub has issues with cross-month date ranges
    // Split the query by month to avoid missing data
    const allEarnings: any[] = [];
    
    // Generate strictly month-by-month ranges to avoid cross-month queries
    // Parse dates as YYYY-MM-DD strings to avoid timezone issues
    const startYear = parseInt(fromDate.substring(0, 4));
    const startMonth = parseInt(fromDate.substring(5, 7));
    const endYear = parseInt(toDate.substring(0, 4));
    const endMonth = parseInt(toDate.substring(5, 7));
    
    for (let year = startYear; year <= endYear; year++) {
      const firstMonth = year === startYear ? startMonth : 1;
      const lastMonth = year === endYear ? endMonth : 12;
      
      for (let month = firstMonth; month <= lastMonth; month++) {
        // Calculate month boundaries as strings
        const monthStartStr = `${year}-${month.toString().padStart(2, "0")}-01`;
        
        // Get last day of month
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        const lastDay = new Date(nextYear, nextMonth - 1, 0).getDate();
        const monthEndStr = `${year}-${month.toString().padStart(2, "0")}-${lastDay.toString().padStart(2, "0")}`;
        
        // Constrain to our actual date range
        const queryStart = monthStartStr < fromDate ? fromDate : monthStartStr;
        const queryEnd = monthEndStr > toDate ? toDate : monthEndStr;
        
        // Skip if this month doesn't overlap with our range
        if (queryStart > queryEnd) continue;
        
        logger.debug(`[API] Querying month ${year}-${month}: ${queryStart} to ${queryEnd}`);
        
        const url = `${FINNHUB_BASE_URL}/calendar/earnings?from=${queryStart}&to=${queryEnd}&token=${FINNHUB_API_KEY}`;
        
        const res = await fetch(url);
        if (!res.ok) {
          logger.error("[API] Finnhub fetch failed for month:", year, month, res.status, res.statusText);
          continue;
        }
        
        const data = await res.json();
        const monthEarnings = Array.isArray(data.earningsCalendar) ? data.earningsCalendar : [];
        allEarnings.push(...monthEarnings);
        
        logger.debug(`[API] Found ${monthEarnings.length} earnings for month ${year}-${month}`);
      }
    }
    
    logger.debug(`[API] Total earnings from all months: ${allEarnings.length}`);
    
    // Filter to exact date range and remove duplicates
    const earnings = allEarnings
      .filter((e: any) => {
        const earningDate = e.date;
        return earningDate >= fromDate && earningDate <= toDate;
      })
      .filter((e: any, index: number, self: any[]) => {
        // Remove duplicates by symbol+date combination
        return index === self.findIndex((other: any) => other.symbol === e.symbol && other.date === e.date);
      });
    
    // Filter for tech stocks and process
    const techEarnings = earnings.filter((e: any) => techSymbols.has(e.symbol));
    logger.debug(
      `[API] Filtered ${techEarnings.length} tech earnings from ${earnings.length} total earnings`
    );
    
    const result = techEarnings.map((e: any) => {
      const actual = typeof e.epsActual === "number" 
        ? e.epsActual 
        : (e.epsActual ? parseFloat(e.epsActual) : null);
      const estimate = typeof e.epsEstimate === "number" 
        ? e.epsEstimate 
        : (e.epsEstimate ? parseFloat(e.epsEstimate) : null);
      
      let surprise = null;
      let surprisePercent = null;
      
      if (actual !== null && estimate !== null && !isNaN(actual) && !isNaN(estimate)) {
        surprise = actual - estimate;
        surprisePercent = estimate !== 0 ? ((actual - estimate) / Math.abs(estimate)) * 100 : null;
      }
      
      // Get additional info from tech tickers
      const techTicker = techTickers.find((t) => t.symbol === e.symbol);
      
      return {
        symbol: e.symbol,
        date: e.date,
        actual,
        estimate,
        surprise,
        surprisePercent,
        hour: e.hour,
        quarter: e.quarter,
        year: e.year,
        exchange: techTicker?.exchange || undefined,
        description: techTicker?.description || undefined,
      };
    });

    // Sort by date ascending (nearest dates first)
    const sortedResult = result.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateA - dateB;
    });

    logger.debug(`[API] Found ${sortedResult.length} earnings records for next 30 days`);
    
    const response: EarningsResponse = {
      earnings: sortedResult,
      totalFound: sortedResult.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error("[API] Error fetching next 30 days earnings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
