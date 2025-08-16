import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import type { EarningsResponse } from "@/types";
import { logger } from "@/lib/logger";

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

  // Calculate date range based on year and quarter
  let fromDate = "";
  let toDate = "";
  
  if (year) {
    if (quarter) {
      // Specific quarter
      const quarterStart: Record<string, string> = {
        "1": "01-01",
        "2": "04-01", 
        "3": "07-01",
        "4": "10-01",
      };
      const quarterEnd: Record<string, string> = {
        "1": "03-31",
        "2": "06-30",
        "3": "09-30", 
        "4": "12-31",
      };
      
      const startDate = quarterStart[quarter];
      const endDate = quarterEnd[quarter];
      
      if (startDate && endDate) {
        fromDate = `${year}-${startDate}`;
        toDate = `${year}-${endDate}`;
      }
    } else {
      // Full year
      fromDate = `${year}-01-01`;
      toDate = `${year}-12-31`;
    }
  }

  // Use Finnhub earnings calendar endpoint
  const urlParams = new URLSearchParams({
    symbol: symbol,
    token: FINNHUB_API_KEY,
  });
  
  if (fromDate) urlParams.append("from", fromDate);
  if (toDate) urlParams.append("to", toDate);
  
  const url = `${FINNHUB_BASE_URL}/calendar/earnings?${urlParams.toString()}`;

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
    
    const earnings = Array.isArray(data.earningsCalendar) ? data.earningsCalendar : [];
    
    // Map to relevant fields and calculate surprise fields
    const result = earnings.map((e: any) => {
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
      };
    });

    const response: EarningsResponse = {
      earnings: result,
      totalFound: result.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error("[API] Error fetching earnings for symbol:", symbol, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
