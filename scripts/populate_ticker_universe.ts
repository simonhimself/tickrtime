/**
 * Ticker Universe Population Script
 *
 * This script populates the D1 tickers table with all US stocks from NASDAQ and NYSE.
 * It runs in two phases:
 *   1. Quick phase: Fetch all symbols and insert basic data (2 API calls, ~10,000 symbols)
 *   2. Enrichment phase: Fetch profile data for each symbol to get industry (rate-limited)
 *
 * Usage:
 *   npm run populate:tickers           # Populate local D1 database
 *   npm run populate:tickers -- --remote  # Populate remote/production D1
 *   npm run populate:tickers -- --enrich-only  # Only run enrichment (skip symbol fetch)
 *   npm run populate:tickers -- --skip-enrich  # Only insert symbols (skip profile fetch)
 *
 * Environment variables:
 *   FINNHUB_API_KEY - Required for Finnhub API access
 *   CF_ACCOUNT_ID - Required for remote D1 access
 *   CF_API_TOKEN - Required for remote D1 access
 *   D1_DATABASE_ID - Required for remote D1 access
 */

import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';
const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

// Exchanges to fetch (MIC codes)
const EXCHANGES = [
  { mic: 'XNAS', exchange: 'NASDAQ' },
  { mic: 'XNYS', exchange: 'NYSE' },
];

// Rate limiting configuration (Finnhub free tier: 60 calls/minute)
const BATCH_SIZE = 55; // Leave buffer for other API usage
const BATCH_DELAY_MS = 61_000; // 61 seconds between batches
const RETRY_LIMIT = 3;
const RETRY_DELAY_MS = 5_000;

// Progress file for resumable enrichment
const PROGRESS_FILE = path.join(__dirname, 'enrich_progress.json');

// Sector mapping (duplicated from tickers.ts for standalone script)
const SECTOR_MAPPING: Record<string, string> = {
  Technology: 'Technology',
  Software: 'Technology',
  Hardware: 'Technology',
  Semiconductors: 'Technology',
  'Electronic Components': 'Technology',
  'Computer Hardware': 'Technology',
  'Information Technology Services': 'Technology',
  Healthcare: 'Healthcare',
  Pharmaceuticals: 'Healthcare',
  Biotechnology: 'Healthcare',
  'Medical Devices': 'Healthcare',
  'Healthcare Plans': 'Healthcare',
  'Medical Care Facilities': 'Healthcare',
  'Drug Manufacturers': 'Healthcare',
  'Diagnostics & Research': 'Healthcare',
  'Medical Instruments & Supplies': 'Healthcare',
  'Financial Services': 'Financials',
  Banks: 'Financials',
  Insurance: 'Financials',
  'Asset Management': 'Financials',
  'Capital Markets': 'Financials',
  'Credit Services': 'Financials',
  'Financial Data & Stock Exchanges': 'Financials',
  'Insurance - Life': 'Financials',
  'Insurance - Property & Casualty': 'Financials',
  'Banks - Regional': 'Financials',
  'Banks - Diversified': 'Financials',
  'Consumer Cyclical': 'Consumer',
  'Consumer Defensive': 'Consumer',
  Retail: 'Consumer',
  Restaurants: 'Consumer',
  Apparel: 'Consumer',
  'Auto Manufacturers': 'Consumer',
  'Auto Parts': 'Consumer',
  Leisure: 'Consumer',
  'Packaging & Containers': 'Consumer',
  'Personal Services': 'Consumer',
  'Specialty Retail': 'Consumer',
  Beverages: 'Consumer',
  'Food Products': 'Consumer',
  'Household Products': 'Consumer',
  Tobacco: 'Consumer',
  Industrials: 'Industrials',
  Industrial: 'Industrials',
  Manufacturing: 'Industrials',
  'Aerospace & Defense': 'Industrials',
  Airlines: 'Industrials',
  'Building Materials': 'Industrials',
  Construction: 'Industrials',
  'Farm & Heavy Construction Machinery': 'Industrials',
  'Industrial Distribution': 'Industrials',
  'Waste Management': 'Industrials',
  Trucking: 'Industrials',
  Railroads: 'Industrials',
  'Marine Shipping': 'Industrials',
  Energy: 'Energy',
  'Oil & Gas': 'Energy',
  'Oil & Gas E&P': 'Energy',
  'Oil & Gas Integrated': 'Energy',
  'Oil & Gas Midstream': 'Energy',
  'Oil & Gas Refining & Marketing': 'Energy',
  'Oil & Gas Equipment & Services': 'Energy',
  Utilities: 'Utilities',
  'Utilities - Regulated Electric': 'Utilities',
  'Utilities - Regulated Gas': 'Utilities',
  'Utilities - Diversified': 'Utilities',
  'Utilities - Renewable': 'Utilities',
  'Utilities - Independent Power Producers': 'Utilities',
  'Real Estate': 'Real Estate',
  REIT: 'Real Estate',
  'REIT - Retail': 'Real Estate',
  'REIT - Residential': 'Real Estate',
  'REIT - Office': 'Real Estate',
  'REIT - Healthcare Facilities': 'Real Estate',
  'REIT - Industrial': 'Real Estate',
  'REIT - Diversified': 'Real Estate',
  'Real Estate Services': 'Real Estate',
  'Real Estate Development': 'Real Estate',
  'Communication Services': 'Communication',
  Communication: 'Communication',
  Media: 'Communication',
  'Telecom Services': 'Communication',
  Entertainment: 'Communication',
  'Advertising Agencies': 'Communication',
  Broadcasting: 'Communication',
  'Internet Content & Information': 'Communication',
  'Electronic Gaming & Multimedia': 'Communication',
  'Basic Materials': 'Materials',
  Materials: 'Materials',
  Chemicals: 'Materials',
  Steel: 'Materials',
  Aluminum: 'Materials',
  Copper: 'Materials',
  Gold: 'Materials',
  Silver: 'Materials',
  'Lumber & Wood Production': 'Materials',
  'Paper & Paper Products': 'Materials',
  'Specialty Chemicals': 'Materials',
};

function mapIndustryToSector(industry: string | null | undefined): string | null {
  if (!industry) return null;
  return SECTOR_MAPPING[industry] ?? 'Other';
}

interface FinnhubSymbol {
  symbol: string;
  description: string;
  type?: string;
  displaySymbol?: string;
}

interface FinnhubProfile {
  finnhubIndustry?: string;
  name?: string;
  country?: string;
  exchange?: string;
  ipo?: string;
  marketCapitalization?: number;
  shareOutstanding?: number;
  logo?: string;
  phone?: string;
  weburl?: string;
  ticker?: string;
}

interface TickerToInsert {
  symbol: string;
  description: string;
  exchange: string;
}

interface EnrichmentProgress {
  lastProcessedIndex: number;
  totalSymbols: number;
  enrichedCount: number;
  failedSymbols: string[];
}

// Utility functions
async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry<T>(
  url: string,
  retries: number = RETRY_LIMIT
): Promise<T | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 429) {
          console.warn(`Rate limited. Waiting 60 seconds...`);
          await delay(60_000);
          continue;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return (await response.json()) as T;
    } catch (error) {
      console.warn(`Attempt ${attempt}/${retries} failed:`, error);
      if (attempt < retries) {
        await delay(RETRY_DELAY_MS);
      }
    }
  }
  return null;
}

// Fetch all symbols from an exchange
async function fetchExchangeSymbols(
  mic: string,
  exchange: string
): Promise<TickerToInsert[]> {
  console.log(`\nFetching symbols from ${exchange} (${mic})...`);

  const url = `${FINNHUB_BASE_URL}/stock/symbol?exchange=US&mic=${mic}&token=${FINNHUB_API_KEY}`;
  const data = await fetchWithRetry<FinnhubSymbol[]>(url);

  if (!data || !Array.isArray(data)) {
    throw new Error(`Failed to fetch symbols for ${exchange}`);
  }

  console.log(`  Found ${data.length} symbols on ${exchange}`);

  return data.map((item) => ({
    symbol: item.symbol,
    description: item.description || item.displaySymbol || item.symbol,
    exchange,
  }));
}

// Fetch profile data for a symbol
async function fetchProfile(symbol: string): Promise<FinnhubProfile | null> {
  const url = `${FINNHUB_BASE_URL}/stock/profile2?symbol=${symbol}&token=${FINNHUB_API_KEY}`;
  return fetchWithRetry<FinnhubProfile>(url, 2);
}

// Execute SQL on local D1 using wrangler
function executeLocalSQL(sql: string): void {
  const escapedSql = sql.replace(/'/g, "'\\''");
  const cmd = `cd packages/api && npx wrangler d1 execute tickrtime-db --local --command='${escapedSql}'`;
  execSync(cmd, { stdio: 'inherit', cwd: process.cwd().replace('/scripts', '') });
}

// Execute SQL batch on local D1
function executeBatchLocalSQL(statements: string[]): void {
  // Write statements to a temp file in packages/api directory and execute
  const projectRoot = process.cwd().includes('/scripts')
    ? process.cwd().replace('/scripts', '')
    : process.cwd();
  const tempFile = path.join(projectRoot, 'packages', 'api', 'temp_batch.sql');
  const sqlContent = statements.join(';\n') + ';';

  // Using sync file operations for simplicity in this script
  require('fs').writeFileSync(tempFile, sqlContent);

  try {
    const cmd = `cd packages/api && npx wrangler d1 execute tickrtime-db --local --file=temp_batch.sql`;
    execSync(cmd, {
      stdio: 'inherit',
      cwd: projectRoot,
    });
  } finally {
    require('fs').unlinkSync(tempFile);
  }
}

// Execute SQL batch on remote D1 (production)
function executeBatchRemoteSQL(statements: string[]): void {
  const projectRoot = process.cwd().includes('/scripts')
    ? process.cwd().replace('/scripts', '')
    : process.cwd();
  const tempFile = path.join(projectRoot, 'packages', 'api', 'temp_batch.sql');
  const sqlContent = statements.join(';\n') + ';';

  require('fs').writeFileSync(tempFile, sqlContent);

  try {
    const cmd = `cd packages/api && npx wrangler d1 execute tickrtime-db --remote --env production --file=temp_batch.sql`;
    execSync(cmd, {
      stdio: 'inherit',
      cwd: projectRoot,
    });
  } finally {
    require('fs').unlinkSync(tempFile);
  }
}

// Insert tickers into D1 (local or remote)
async function insertTickers(tickers: TickerToInsert[], isRemote: boolean): Promise<void> {
  const target = isRemote ? 'remote (production)' : 'local';
  console.log(`\nInserting ${tickers.length} tickers into ${target} D1...`);

  const now = new Date().toISOString();
  const BATCH_INSERT_SIZE = 50; // SQLite has limits on compound statements

  for (let i = 0; i < tickers.length; i += BATCH_INSERT_SIZE) {
    const batch = tickers.slice(i, i + BATCH_INSERT_SIZE);

    const statements = batch.map((t) => {
      const desc = t.description.replace(/'/g, "''");
      return `INSERT OR IGNORE INTO tickers (symbol, description, exchange, is_active, created_at, updated_at) VALUES ('${t.symbol}', '${desc}', '${t.exchange}', 1, '${now}', '${now}')`;
    });

    try {
      if (isRemote) {
        executeBatchRemoteSQL(statements);
      } else {
        executeBatchLocalSQL(statements);
      }
    } catch (error) {
      console.error(`Error inserting batch ${i}-${i + batch.length}:`, error);
      // Continue with next batch
    }

    // Progress update
    const progress = Math.min(i + BATCH_INSERT_SIZE, tickers.length);
    process.stdout.write(`\r  Inserted: ${progress}/${tickers.length}`);
  }

  console.log('\n  Insert complete!');
}

// Update ticker with profile data
function updateTickerProfileLocal(
  symbol: string,
  industry: string | null,
  sector: string | null
): void {
  const now = new Date().toISOString();
  const industryVal = industry ? `'${industry.replace(/'/g, "''")}'` : 'NULL';
  const sectorVal = sector ? `'${sector.replace(/'/g, "''")}'` : 'NULL';

  const sql = `UPDATE tickers SET industry = ${industryVal}, sector = ${sectorVal}, profile_fetched_at = '${now}', updated_at = '${now}' WHERE symbol = '${symbol}'`;

  try {
    executeLocalSQL(sql);
  } catch (error) {
    // Ignore errors for individual updates
  }
}

// Load enrichment progress
async function loadProgress(): Promise<EnrichmentProgress | null> {
  try {
    const content = await fs.readFile(PROGRESS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// Save enrichment progress
async function saveProgress(progress: EnrichmentProgress): Promise<void> {
  await fs.writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// Get all symbols from local D1 that need enrichment
function getUnenrichedSymbolsLocal(): string[] {
  const cmd = `cd packages/api && npx wrangler d1 execute tickrtime-db --local --command="SELECT symbol FROM tickers WHERE is_active = 1 AND profile_fetched_at IS NULL ORDER BY symbol" --json`;

  try {
    const result = execSync(cmd, {
      encoding: 'utf-8',
      cwd: process.cwd().replace('/scripts', ''),
    });

    const parsed = JSON.parse(result);
    if (parsed && Array.isArray(parsed) && parsed[0]?.results) {
      return parsed[0].results.map((r: { symbol: string }) => r.symbol);
    }
    return [];
  } catch (error) {
    console.error('Error fetching unenriched symbols:', error);
    return [];
  }
}

// Main enrichment phase
async function enrichTickers(symbols: string[]): Promise<void> {
  console.log(`\n=== Starting Enrichment Phase ===`);
  console.log(`Total symbols to enrich: ${symbols.length}`);
  console.log(`Rate limit: ${BATCH_SIZE} calls/minute`);
  console.log(
    `Estimated time: ${Math.ceil(symbols.length / BATCH_SIZE)} minutes\n`
  );

  // Load progress if exists
  let startIndex = 0;
  let enrichedCount = 0;
  const failedSymbols: string[] = [];

  const savedProgress = await loadProgress();
  if (savedProgress && savedProgress.totalSymbols === symbols.length) {
    startIndex = savedProgress.lastProcessedIndex + 1;
    enrichedCount = savedProgress.enrichedCount;
    failedSymbols.push(...savedProgress.failedSymbols);
    console.log(`Resuming from index ${startIndex} (${enrichedCount} already enriched)`);
  }

  for (let i = startIndex; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(symbols.length / BATCH_SIZE);

    console.log(`\nBatch ${batchNum}/${totalBatches} (symbols ${i + 1}-${Math.min(i + BATCH_SIZE, symbols.length)})`);

    // Process batch in parallel
    const profilePromises = batch.map(async (symbol) => {
      const profile = await fetchProfile(symbol);
      return { symbol, profile };
    });

    const results = await Promise.all(profilePromises);

    // Update database with results
    for (const { symbol, profile } of results) {
      if (profile && profile.finnhubIndustry) {
        const sector = mapIndustryToSector(profile.finnhubIndustry);
        updateTickerProfileLocal(symbol, profile.finnhubIndustry, sector);
        enrichedCount++;
      } else if (profile) {
        // Profile exists but no industry - mark as fetched with null industry
        updateTickerProfileLocal(symbol, null, null);
        enrichedCount++;
      } else {
        failedSymbols.push(symbol);
      }
    }

    // Save progress
    await saveProgress({
      lastProcessedIndex: i + batch.length - 1,
      totalSymbols: symbols.length,
      enrichedCount,
      failedSymbols,
    });

    console.log(`  Enriched: ${enrichedCount}, Failed: ${failedSymbols.length}`);

    // Wait before next batch (if not last batch)
    if (i + BATCH_SIZE < symbols.length) {
      console.log(`  Waiting ${BATCH_DELAY_MS / 1000}s for rate limit...`);
      await delay(BATCH_DELAY_MS);
    }
  }

  console.log(`\n=== Enrichment Complete ===`);
  console.log(`Total enriched: ${enrichedCount}`);
  console.log(`Total failed: ${failedSymbols.length}`);

  if (failedSymbols.length > 0) {
    console.log(`Failed symbols saved to: ${PROGRESS_FILE}`);
  } else {
    // Clean up progress file on success
    try {
      await fs.unlink(PROGRESS_FILE);
    } catch {
      // Ignore
    }
  }
}

// Main function
async function main(): Promise<void> {
  console.log('=== Ticker Universe Population Script ===\n');

  // Validate environment
  if (!FINNHUB_API_KEY) {
    console.error('Error: FINNHUB_API_KEY environment variable is required');
    process.exit(1);
  }

  // Parse arguments
  const args = process.argv.slice(2);
  const isRemote = args.includes('--remote');
  const enrichOnly = args.includes('--enrich-only');
  const skipEnrich = args.includes('--skip-enrich');

  console.log(`Mode: ${isRemote ? 'Remote (production)' : 'Local'} D1 database`);
  console.log(`Exchanges: ${EXCHANGES.map((e) => e.exchange).join(', ')}`);

  // Phase 1: Fetch and insert symbols
  if (!enrichOnly) {
    console.log('\n=== Phase 1: Fetching Symbols ===');

    const allTickers: TickerToInsert[] = [];

    for (const { mic, exchange } of EXCHANGES) {
      const tickers = await fetchExchangeSymbols(mic, exchange);
      allTickers.push(...tickers);
    }

    console.log(`\nTotal symbols fetched: ${allTickers.length}`);

    // Insert into database
    await insertTickers(allTickers, isRemote);
  }

  // Phase 2: Enrich with profile data (local only for now)
  if (!skipEnrich && !isRemote) {
    console.log('\n=== Phase 2: Profile Enrichment ===');

    // Get symbols that need enrichment
    const unenrichedSymbols = getUnenrichedSymbolsLocal();

    if (unenrichedSymbols.length === 0) {
      console.log('All symbols already enriched!');
    } else {
      console.log(`Found ${unenrichedSymbols.length} symbols needing enrichment`);

      // Confirm before starting long-running enrichment
      console.log(
        `\nThis will take approximately ${Math.ceil(unenrichedSymbols.length / BATCH_SIZE)} minutes.`
      );
      console.log('Press Ctrl+C to cancel. Starting in 5 seconds...');
      await delay(5000);

      await enrichTickers(unenrichedSymbols);
    }
  }

  console.log('\n=== Script Complete ===');
}

// Run
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
