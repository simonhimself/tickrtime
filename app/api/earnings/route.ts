import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import type { EarningsResponse } from "@/types";
import { logger } from "@/lib/logger";
import techTickers from "@/data/tech_tickers.json";

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";

export const runtime = "edge"; // Cloudflare Pages Edge Runtime compatibility

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  const year = searchParams.get("year");
  const quarter = searchParams.get("quarter");

  // Log incoming query parameters
  logger.debug("[API] /api/earnings query params:", { symbol, year, quarter });

  if (!FINNHUB_API_KEY) {
    logger.error("[API] FINNHUB_API_KEY environment variable is not set");
    return NextResponse.json(
      { error: "API configuration error" },
      { status: 500 }
    );
  }

  if (!symbol) {
    return NextResponse.json(
      { error: "Missing symbol parameter" },
      { status: 400 }
    );
  }

  // Use Finnhub stock earnings endpoint (correct endpoint for symbol-specific queries)
  const url = `${FINNHUB_BASE_URL}/stock/earnings?symbol=${symbol.toUpperCase()}&token=${FINNHUB_API_KEY}`;
  logger.debug("[API] Finnhub API URL:", url.replace(FINNHUB_API_KEY, "***"));

  try {
    const res = await fetch(url);
    if (!res.ok) {
      logger.error("[API] Finnhub fetch failed:", res.status, res.statusText);
      return NextResponse.json(
        { error: "Failed to fetch from Finnhub" },
        { status: 500 }
      );
    }
    
    const data = await res.json();
    logger.debug("[API] Finnhub response received for symbol:", symbol);
    
    // /stock/earnings returns an array directly (not wrapped in earningsCalendar)
    let earnings = Array.isArray(data) ? data : [];
    
    // Filter by year if provided
    if (year) {
      earnings = earnings.filter((e: any) => e.year === parseInt(year));
      logger.debug(`[API] Filtered by year ${year}: ${earnings.length} earnings`);
    }
    
    // Filter by quarter if provided
    if (quarter) {
      earnings = earnings.filter((e: any) => e.quarter === parseInt(quarter));
      logger.debug(`[API] Filtered by quarter ${quarter}: ${earnings.length} earnings`);
    }
    
    // Map to relevant fields
    // /stock/earnings provides: period, quarter, year, actual, estimate, surprise, surprisePercent, symbol
    const result = earnings.map((e: any) => {
      // Lookup company info from tech_tickers.json
      const techTicker = techTickers.find((t) => t.symbol === e.symbol);
      
      return {
        symbol: e.symbol,
        date: e.period || "", // period is quarter end date (e.g., "2025-09-30")
        actual: typeof e.actual === "number" ? e.actual : (e.actual ? parseFloat(e.actual) : null),
        estimate: typeof e.estimate === "number" ? e.estimate : (e.estimate ? parseFloat(e.estimate) : null),
        surprise: typeof e.surprise === "number" ? e.surprise : (e.surprise ? parseFloat(e.surprise) : null),
        surprisePercent: typeof e.surprisePercent === "number" 
          ? e.surprisePercent 
          : (e.surprisePercent ? parseFloat(e.surprisePercent) : null),
        hour: undefined, // Not available in /stock/earnings endpoint
        quarter: e.quarter,
        year: e.year,
        exchange: techTicker?.exchange || undefined,
        description: techTicker?.description || undefined,
      };
    });

    const response: EarningsResponse = {
      earnings: result,
      totalFound: result.length,
    };

    logger.debug(`[API] Returning ${result.length} earnings for ${symbol}`);
    return NextResponse.json(response);
  } catch (error) {
    logger.error("[API] Error fetching earnings for symbol:", symbol, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
