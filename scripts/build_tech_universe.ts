// @ts-ignore
const fetch = require('node-fetch');
// @ts-ignore
const fs = require('fs/promises');

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';
const ENDPOINTS = [
  { mic: 'XNAS', exchange: 'NASDAQ' },
  { mic: 'XNYS', exchange: 'NYSE' },
];
const BATCH_SIZE = 50; // Stay below 60/minute
const BATCH_DELAY = 60 * 1000; // 60 seconds
const OUTPUT_FILE = 'tech_tickers.json';
const PARTIAL_FILE = 'tech_tickers_partial.json';
const RETRY_LIMIT = 3;
const RETRY_DELAY = 5000; // 5 seconds

async function fetchTickers(mic: string, exchange: string): Promise<any[]> {
  const url = `https://finnhub.io/api/v1/stock/symbol?exchange=US&mic=${mic}&token=${FINNHUB_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch symbols for ${exchange}: ${res.status} ${res.statusText}`);
  const data = await res.json();
  return data.map((item: any) => ({
    symbol: item.symbol,
    description: item.description,
    exchange,
  }));
}

async function fetchProfileWithRetry(symbol: string): Promise<any | null> {
  for (let attempt = 1; attempt <= RETRY_LIMIT; attempt++) {
    try {
      const url = `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_API_KEY}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt < RETRY_LIMIT) {
        console.warn(`Retrying ${symbol} (attempt ${attempt})...`);
        await new Promise(res => setTimeout(res, RETRY_DELAY));
      } else {
        console.error(`Failed to fetch profile for ${symbol} after ${RETRY_LIMIT} attempts:`, err);
        return null;
      }
    }
  }
}

async function buildTechUniverse() {
  // Load partial file if exists
  let techTickers: any[] = [];
  let processedSymbols: Set<string> = new Set();
  try {
    const partial = await fs.readFile(PARTIAL_FILE, 'utf-8');
    techTickers = JSON.parse(partial);
    processedSymbols = new Set(techTickers.map((t: any) => t.symbol));
    console.log(`Resuming from partial file: ${techTickers.length} tech tickers already found.`);
  } catch {
    // No partial file, start fresh
    console.log('No partial file found, starting fresh.');
  }

  let allTickers: any[] = [];
  for (const e of ENDPOINTS) {
    const tickers = await fetchTickers(e.mic, e.exchange);
    allTickers = allTickers.concat(tickers);
  }
  console.log(`Fetched ${allTickers.length} total tickers.`);

  // Filter out already processed symbols
  const remainingTickers: any[] = allTickers.filter((t: any) => !processedSymbols.has(t.symbol));
  console.log(`Processing ${remainingTickers.length} remaining tickers...`);

  for (let i = 0; i < remainingTickers.length; i += BATCH_SIZE) {
    const batch: any[] = remainingTickers.slice(i, i + BATCH_SIZE);
    const profiles: (any | null)[] = await Promise.all(batch.map((t: any) => fetchProfileWithRetry(t.symbol)));
    for (let j = 0; j < batch.length; j++) {
      const profile = profiles[j];
      if (profile && profile.finnhubIndustry === 'Technology') {
        techTickers.push({ ...batch[j], finnhubIndustry: profile.finnhubIndustry });
      }
    }
    // Write partial results after each batch
    await fs.writeFile(PARTIAL_FILE, JSON.stringify(techTickers, null, 2), 'utf-8');
    console.log(`Current tech tickers found: ${techTickers.length}`);
    console.log(`Processed ${Math.min(i + BATCH_SIZE, remainingTickers.length)} / ${remainingTickers.length}`);
    if (i + BATCH_SIZE < remainingTickers.length) {
      console.log('Waiting to respect rate limits...');
      await new Promise(res => setTimeout(res, BATCH_DELAY));
    }
  }
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(techTickers, null, 2), 'utf-8');
  console.log(`Wrote ${techTickers.length} tech tickers to ${OUTPUT_FILE}`);
}

buildTechUniverse().catch(err => {
  console.error('Error building tech universe:', err);
  process.exit(1);
}); 