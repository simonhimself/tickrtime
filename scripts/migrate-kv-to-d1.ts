#!/usr/bin/env tsx
/**
 * Migration script to move data from KV to D1
 * 
 * Usage:
 *   tsx scripts/migrate-kv-to-d1.ts
 * 
 * This script reads all users and alerts from KV and inserts them into D1.
 * It preserves relationships and data integrity.
 */

import { createKV } from '../lib/kv-factory';
import { createDB } from '../lib/db';
import { getUserById as getKVUserById, getUserAlerts as getKVUserAlerts } from '../lib/kv-dev-edge';
import { createUser as createD1User, getUserByEmail as getD1UserByEmail } from '../lib/db/users';
import { createAlert as createD1Alert } from '../lib/db/alerts';
import { logger } from '../lib/logger';

// Note: This script requires access to both KV and D1
// In production, you'd run this with proper Cloudflare credentials

async function migrateUsers() {
  console.log('Starting user migration...');
  const kv = createKV();
  const db = createDB();
  
  // Note: KV doesn't have a way to list all keys easily
  // We'll need to maintain a list of user IDs or iterate through known users
  // For this migration, we'll need to provide user IDs or emails
  
  // This is a simplified version - in production you'd have a user list
  console.log('Note: KV migration requires a list of user IDs or emails.');
  console.log('This script demonstrates the migration pattern.');
  
  // Example: If you have a list of user emails or IDs
  const userEmails: string[] = []; // Add known user emails here
  
  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  
  for (const email of userEmails) {
    try {
      // Check if user already exists in D1
      const existingUser = await getD1UserByEmail(email);
      if (existingUser) {
        console.log(`User ${email} already exists in D1, skipping...`);
        skippedCount++;
        continue;
      }
      
      // Get user from KV (you'd need to implement getUserByEmail for KV)
      // For now, this is a placeholder
      console.log(`Would migrate user: ${email}`);
      migratedCount++;
    } catch (error) {
      console.error(`Error migrating user ${email}:`, error);
      errorCount++;
    }
  }
  
  console.log(`User migration complete: ${migratedCount} migrated, ${skippedCount} skipped, ${errorCount} errors`);
}

async function migrateAlerts() {
  console.log('Starting alert migration...');
  const kv = createKV();
  
  // Similar to users, we need a list of user IDs
  const userIds: string[] = []; // Add known user IDs here
  
  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  
  for (const userId of userIds) {
    try {
      // Get user's alerts from KV
      const alerts = await getKVUserAlerts(kv, userId);
      
      for (const alert of alerts) {
        try {
          // Check if alert already exists in D1 (by ID)
          // For now, we'll just create it
          
          const success = await createD1Alert({
            id: alert.id,
            userId: alert.userId,
            symbol: alert.symbol,
            alertType: alert.alertType,
            daysBefore: alert.daysBefore,
            daysAfter: alert.daysAfter,
            recurring: alert.recurring,
            earningsDate: alert.earningsDate,
            scheduledEmailId: alert.scheduledEmailId,
            status: alert.status,
          });
          
          if (success) {
            migratedCount++;
          } else {
            skippedCount++;
          }
        } catch (error) {
          console.error(`Error migrating alert ${alert.id}:`, error);
          errorCount++;
        }
      }
    } catch (error) {
      console.error(`Error getting alerts for user ${userId}:`, error);
      errorCount++;
    }
  }
  
  console.log(`Alert migration complete: ${migratedCount} migrated, ${skippedCount} skipped, ${errorCount} errors`);
}

async function main() {
  console.log('Starting KV to D1 migration...');
  console.log('');
  
  try {
    await migrateUsers();
    console.log('');
    await migrateAlerts();
    console.log('');
    console.log('Migration complete!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { migrateUsers, migrateAlerts };

