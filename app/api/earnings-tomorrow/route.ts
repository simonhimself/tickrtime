import { NextRequest, NextResponse } from "next/server";

import techTickers from "@/data/tech_tickers.json";
import type { EarningsResponse } from "@/types";

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";

export const runtime = "edge"; // Cloudflare Pages Edge Runtime compatibility

export async function GET(req: NextRequest) {
  try {
    if (!FINNHUB_API_KEY) {
      console.error("[API] FINNHUB_API_KEY environment variable is not set");
      return NextResponse.json(
        { error: "API configuration error" },
        { status: 500 }
      );
    }

    // Use imported tech tickers for filtering
    const techSymbols = new Set(techTickers.map((t) => t.symbol));
    
    // Get tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0]; // Tomorrow in YYYY-MM-DD format
    
    console.log("[API] /api/earnings-tomorrow date:", tomorrowStr);

    const url = `${FINNHUB_BASE_URL}/calendar/earnings?from=${tomorrowStr}&to=${tomorrowStr}&token=${FINNHUB_API_KEY}`;

    const res = await fetch(url);
    if (!res.ok) {
      console.error("[API] Finnhub fetch failed:", res.status, res.statusText);
      return NextResponse.json(
        { error: "Failed to fetch from Finnhub" },
        { status: 500 }
      );
    }
    
    const data = await res.json();
    console.log("[API] Finnhub response received, processing...");

    const earnings = Array.isArray(data.earningsCalendar) ? data.earningsCalendar : [];
    
    // Filter for tech stocks and process
    const techEarnings = earnings.filter((e: any) => techSymbols.has(e.symbol));
    console.log(
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
        exchange: techTicker?.exchange || null,
        description: techTicker?.description || null,
      };
    });

    // Sort by symbol for consistent ordering
    const sortedResult = result.sort((a, b) => a.symbol.localeCompare(b.symbol));

    console.log(`[API] Found ${sortedResult.length} earnings records for tomorrow`);
    
    const response: EarningsResponse = {
      earnings: sortedResult,
      date: tomorrowStr,
      totalFound: sortedResult.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[API] Error fetching tomorrow's earnings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
