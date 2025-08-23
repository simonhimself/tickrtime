import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logger } from '@/lib/logger';

import type { EarningsResponse } from "@/types";

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";

export const runtime = "edge"; // Cloudflare Pages Edge Runtime compatibility

export async function GET(req: NextRequest) {
  try {
    if (!FINNHUB_API_KEY) {
      logger.error("[API] FINNHUB_API_KEY environment variable is not set");
      return NextResponse.json(
        { error: "API configuration error" },
        { status: 500 }
      );
    }

    // Get symbols from query params
    const { searchParams } = new URL(req.url);
    const symbolsParam = searchParams.get("symbols");
    
    if (!symbolsParam) {
      logger.debug("[API] /api/earnings-watchlist called with no symbols");
      return NextResponse.json<EarningsResponse[]>([]);
    }

    const symbols = symbolsParam.split(",").filter(Boolean);
    
    if (symbols.length === 0) {
      logger.debug("[API] /api/earnings-watchlist called with empty symbols");
      return NextResponse.json<EarningsResponse[]>([]);
    }

    logger.debug("[API] /api/earnings-watchlist fetching earnings for symbols:", symbols);

    // Get current date and calculate date range (current year + next year)
    const today = new Date();
    const currentYear = today.getFullYear();
    const fromDate = today.toISOString().split("T")[0]; // Today
    const toDate = `${currentYear + 1}-12-31`; // End of next year

    // Fetch earnings for each symbol in parallel
    const promises = symbols.map(async (symbol) => {
      try {
        const urlParams = new URLSearchParams({
          symbol: symbol.toUpperCase(),
          from: fromDate!,
          to: toDate,
          token: FINNHUB_API_KEY,
        });

        const url = `${FINNHUB_BASE_URL}/calendar/earnings?${urlParams.toString()}`;
        const res = await fetch(url);
        
        if (!res.ok) {
          logger.error(`[API] Failed to fetch earnings for ${symbol}:`, res.status);
          return [];
        }

        const data = await res.json();
        const earnings = Array.isArray(data.earningsCalendar) ? data.earningsCalendar : [];
        
        // Transform to our format
        return earnings.map((item: any) => ({
          symbol: item.symbol || symbol.toUpperCase(),
          date: item.date,
          quarter: item.quarter,
          year: item.year,
          estimate: item.epsEstimate,
          actual: item.epsActual,
          surprise: item.epsSurprise,
          surprisePercent: item.epsSurprisePercent,
          marketCap: null,
          exchange: null,
          name: null,
        }));
      } catch (error) {
        logger.error(`[API] Error fetching earnings for ${symbol}:`, error);
        return [];
      }
    });

    // Wait for all fetches to complete
    const results = await Promise.all(promises);
    
    // Flatten and filter to only future earnings
    const allFutureEarnings = results
      .flat()
      .filter((earning) => {
        if (!earning.date) return false;
        const earningDate = new Date(earning.date);
        return earningDate >= today;
      })
      .sort((a, b) => {
        const dateA = new Date(a.date || 0);
        const dateB = new Date(b.date || 0);
        return dateA.getTime() - dateB.getTime();
      });

    // Smart filtering: For each ticker, show only the next relevant earnings
    // (either current quarter if not passed, or next quarter)
    const earningsByTicker = new Map<string, typeof allFutureEarnings>();
    
    allFutureEarnings.forEach(earning => {
      const symbol = earning.symbol;
      if (!earningsByTicker.has(symbol)) {
        earningsByTicker.set(symbol, []);
      }
      earningsByTicker.get(symbol)!.push(earning);
    });

    // For each ticker, select the most relevant upcoming earning
    const allEarnings = Array.from(earningsByTicker.values())
      .map(tickerEarnings => {
        // Already sorted by date, so first item is the next earnings
        return tickerEarnings[0];
      })
      .filter(Boolean)
      .sort((a, b) => {
        const dateA = new Date(a.date || 0);
        const dateB = new Date(b.date || 0);
        return dateA.getTime() - dateB.getTime();
      });

    logger.debug(`[API] Found ${allEarnings.length} next relevant earnings for watchlist (filtered from ${allFutureEarnings.length} total future earnings)`);
    
    return NextResponse.json<EarningsResponse[]>(allEarnings);
    
  } catch (error) {
    logger.error("[API] /api/earnings-watchlist error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}