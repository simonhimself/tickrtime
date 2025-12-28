/**
 * Sync Ticker Enrichment from Production to Local
 *
 * This script copies ticker enrichment data (industry, sector, profile_fetched_at)
 * from production D1 to local D1, keeping reference data in sync while
 * preserving local user data (users, alerts, watchlists).
 *
 * Usage:
 *   npm run sync:tickers          # Sync enrichment data from prod to local
 *   npm run sync:tickers -- --dry-run  # Preview without making changes
 *
 * Requirements:
 *   - wrangler CLI installed and authenticated
 *   - Local D1 database initialized with same schema
 */

import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const BATCH_SIZE = 500; // SQL statements per batch
const DRY_RUN = process.argv.includes('--dry-run');
const TEMP_DIR = '/tmp';
const API_DIR = path.join(process.cwd(), 'packages/api');

interface TickerRow {
  symbol: string;
  industry: string | null;
  sector: string | null;
  profile_fetched_at: string | null;
}

interface D1Result {
  results: TickerRow[];
}

function log(message: string): void {
  console.log(`[sync-tickers] ${message}`);
}

function execWrangler(command: string): void {
  execSync(command, {
    encoding: 'utf-8',
    cwd: API_DIR,
    stdio: 'inherit',
  });
}

function execWranglerToFile(command: string, outputFile: string): boolean {
  const result = spawnSync('sh', ['-c', command], {
    cwd: API_DIR,
    stdio: ['pipe', fs.openSync(outputFile, 'w'), 'pipe'],
  });
  return result.status === 0;
}

function getLocalCount(): number {
  const tempFile = path.join(TEMP_DIR, 'local_count.json');
  try {
    execSync(
      `npx wrangler d1 execute tickrtime-db --local --command "SELECT COUNT(*) as cnt FROM tickers WHERE profile_fetched_at IS NOT NULL" --json > "${tempFile}"`,
      { cwd: API_DIR, stdio: 'pipe' }
    );
    const data = JSON.parse(fs.readFileSync(tempFile, 'utf-8'));
    fs.unlinkSync(tempFile);
    return (data[0]?.results[0] as { cnt: number })?.cnt || 0;
  } catch {
    return 0;
  }
}

async function main(): Promise<void> {
  log('Starting ticker sync from production to local...');

  if (DRY_RUN) {
    log('DRY RUN MODE - No changes will be made');
  }

  // Step 1: Export enriched tickers from production to file
  log('Fetching enriched tickers from production...');

  const exportFile = path.join(TEMP_DIR, 'prod_tickers.json');
  const query = `SELECT symbol, industry, sector, profile_fetched_at FROM tickers WHERE profile_fetched_at IS NOT NULL`;

  const success = execWranglerToFile(
    `npx wrangler d1 execute tickrtime-db --remote --command "${query}" --json`,
    exportFile
  );

  if (!success || !fs.existsSync(exportFile)) {
    throw new Error('Failed to export production data');
  }

  // Step 2: Parse the exported data
  log('Parsing exported data...');
  const rawData = fs.readFileSync(exportFile, 'utf-8');
  const prodData: D1Result[] = JSON.parse(rawData);
  const enrichedTickers = prodData[0]?.results || [];

  log(`Found ${enrichedTickers.length} enriched tickers in production`);

  // Clean up export file
  fs.unlinkSync(exportFile);

  if (enrichedTickers.length === 0) {
    log('No enriched tickers to sync. Exiting.');
    return;
  }

  // Step 3: Check local state
  const localEnrichedCount = getLocalCount();
  log(`Local database has ${localEnrichedCount} enriched tickers`);

  if (DRY_RUN) {
    log(`Would update ${enrichedTickers.length} tickers in local database`);
    log('Sample updates (first 5):');
    enrichedTickers.slice(0, 5).forEach((t) => {
      log(`  ${t.symbol}: industry=${t.industry}, sector=${t.sector}`);
    });
    return;
  }

  // Step 4: Generate and execute UPDATE statements in batches
  log('Updating local database...');

  let updatedCount = 0;
  const batches = Math.ceil(enrichedTickers.length / BATCH_SIZE);

  for (let i = 0; i < batches; i++) {
    const batchStart = i * BATCH_SIZE;
    const batchEnd = Math.min((i + 1) * BATCH_SIZE, enrichedTickers.length);
    const batch = enrichedTickers.slice(batchStart, batchEnd);

    process.stdout.write(`\r[sync-tickers] Processing batch ${i + 1}/${batches} (${batchEnd}/${enrichedTickers.length} tickers)...`);

    // Build SQL for this batch
    const statements = batch.map((ticker) => {
      const industry = ticker.industry ? `'${ticker.industry.replace(/'/g, "''")}'` : 'NULL';
      const sector = ticker.sector ? `'${ticker.sector.replace(/'/g, "''")}'` : 'NULL';
      const fetchedAt = ticker.profile_fetched_at ? `'${ticker.profile_fetched_at}'` : 'NULL';

      return `UPDATE tickers SET industry = ${industry}, sector = ${sector}, profile_fetched_at = ${fetchedAt} WHERE symbol = '${ticker.symbol}';`;
    });

    // Write to temp file and execute
    const tempFile = path.join(TEMP_DIR, `ticker_sync_batch_${i}.sql`);
    fs.writeFileSync(tempFile, statements.join('\n'));

    try {
      execSync(`npx wrangler d1 execute tickrtime-db --local --file="${tempFile}"`, {
        cwd: API_DIR,
        stdio: 'pipe',
      });
      updatedCount += batch.length;
    } catch (error) {
      console.log(`\n[sync-tickers] Warning: Batch ${i + 1} had errors, some updates may have failed`);
    }

    // Clean up temp file
    try {
      fs.unlinkSync(tempFile);
    } catch {}
  }

  console.log(''); // New line after progress

  // Step 5: Verify
  log('Verifying sync...');
  const newLocalCount = getLocalCount();

  log('');
  log('=== Sync Complete ===');
  log(`Production enriched: ${enrichedTickers.length}`);
  log(`Local enriched before: ${localEnrichedCount}`);
  log(`Local enriched after: ${newLocalCount}`);
  log(`New enrichments: ${newLocalCount - localEnrichedCount}`);
}

main().catch((error) => {
  console.error('Sync failed:', error.message || error);
  process.exit(1);
});
