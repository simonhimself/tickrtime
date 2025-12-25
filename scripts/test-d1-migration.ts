#!/usr/bin/env tsx
/**
 * Integration test script for D1 Migration
 * 
 * This script tests the D1 database operations to ensure the migration works correctly.
 * Run with: tsx scripts/test-d1-migration.ts
 */

import { createDB } from '../lib/db';
import { createUser, getUserById, getUserByEmail, updateUser, deleteUser } from '../lib/db/users';
import { createAlert, getUserAlerts, getAlertById, updateAlert, deleteAlert, getActiveAfterAlerts } from '../lib/db/alerts';
import { logger } from '../lib/logger';

async function testUserOperations() {
  console.log('\n🧪 Testing User Operations...\n');
  
  const testUserId = `test-user-${Date.now()}`;
  const testUserEmail = `test-${Date.now()}@example.com`;
  const testPasswordHash = 'test_hash_12345';

  try {
    // Test 1: Create user
    console.log('1. Creating user...');
    const createSuccess = await createUser({
      id: testUserId,
      email: testUserEmail,
      passwordHash: testPasswordHash,
      emailVerified: false,
    });
    console.log(`   ✅ User created: ${createSuccess ? 'SUCCESS' : 'FAILED'}`);
    if (!createSuccess) throw new Error('Failed to create user');

    // Test 2: Get user by ID
    console.log('2. Getting user by ID...');
    const userById = await getUserById(testUserId);
    console.log(`   ✅ User found: ${userById ? 'SUCCESS' : 'FAILED'}`);
    if (!userById) throw new Error('Failed to get user by ID');
    console.log(`   📧 Email: ${userById.email}, Verified: ${userById.emailVerified}`);

    // Test 3: Get user by email (normalized)
    console.log('3. Getting user by email (uppercase test)...');
    const userByEmail = await getUserByEmail(testUserEmail.toUpperCase());
    console.log(`   ✅ User found by email: ${userByEmail ? 'SUCCESS' : 'FAILED'}`);
    if (!userByEmail) throw new Error('Failed to get user by email');
    console.log(`   📧 Found email: ${userByEmail.email}`);

    // Test 4: Update user
    console.log('4. Updating user...');
    const updateSuccess = await updateUser(testUserId, {
      emailVerified: true,
      notificationPreferences: {
        emailEnabled: true,
        defaultDaysBefore: 2,
        defaultDaysAfter: 1,
      },
    });
    console.log(`   ✅ User updated: ${updateSuccess ? 'SUCCESS' : 'FAILED'}`);
    if (!updateSuccess) throw new Error('Failed to update user');

    const updatedUser = await getUserById(testUserId);
    console.log(`   📧 Verified: ${updatedUser?.emailVerified}, Prefs: ${JSON.stringify(updatedUser?.notificationPreferences)}`);

    // Test 5: Non-existent user
    console.log('5. Testing non-existent user...');
    const nonExistent = await getUserById('non-existent-id-12345');
    console.log(`   ✅ Non-existent check: ${nonExistent === null ? 'SUCCESS' : 'FAILED'}`);

    return { testUserId, testUserEmail };
  } catch (error) {
    console.error('   ❌ User operations test failed:', error);
    throw error;
  }
}

async function testAlertOperations(testUserId: string) {
  console.log('\n🧪 Testing Alert Operations...\n');

  const testAlertId = `test-alert-${Date.now()}`;
  const earningsDate = new Date();
  earningsDate.setDate(earningsDate.getDate() + 7); // 7 days from now
  const earningsDateStr = earningsDate.toISOString().split('T')[0];

  try {
    // Test 1: Create alert
    console.log('1. Creating alert...');
    const createSuccess = await createAlert({
      id: testAlertId,
      userId: testUserId,
      symbol: 'AAPL',
      alertType: 'before',
      daysBefore: 1,
      recurring: false,
      earningsDate: earningsDateStr,
      status: 'active',
    });
    console.log(`   ✅ Alert created: ${createSuccess ? 'SUCCESS' : 'FAILED'}`);
    if (!createSuccess) throw new Error('Failed to create alert');

    // Test 2: Get alert by ID
    console.log('2. Getting alert by ID...');
    const alertById = await getAlertById(testAlertId);
    console.log(`   ✅ Alert found: ${alertById ? 'SUCCESS' : 'FAILED'}`);
    if (!alertById) throw new Error('Failed to get alert by ID');
    console.log(`   📊 Symbol: ${alertById.symbol}, Type: ${alertById.alertType}, Days: ${alertById.daysBefore}`);

    // Test 3: Get user alerts
    console.log('3. Getting user alerts...');
    const userAlerts = await getUserAlerts(testUserId);
    console.log(`   ✅ User alerts retrieved: ${userAlerts.length > 0 ? 'SUCCESS' : 'FAILED'}`);
    console.log(`   📊 Total alerts: ${userAlerts.length}`);

    // Test 4: Update alert
    console.log('4. Updating alert...');
    const updateSuccess = await updateAlert(testAlertId, {
      daysBefore: 2,
      status: 'active',
    });
    console.log(`   ✅ Alert updated: ${updateSuccess ? 'SUCCESS' : 'FAILED'}`);
    if (!updateSuccess) throw new Error('Failed to update alert');

    const updatedAlert = await getAlertById(testAlertId);
    console.log(`   📊 Updated daysBefore: ${updatedAlert?.daysBefore}`);

    // Test 5: Create "after" alert for cron test
    console.log('5. Creating "after" alert for cron test...');
    const afterAlertId = `test-after-${Date.now()}`;
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1); // Yesterday

    await createAlert({
      id: afterAlertId,
      userId: testUserId,
      symbol: 'MSFT',
      alertType: 'after',
      daysAfter: 0,
      recurring: false,
      earningsDate: pastDate.toISOString().split('T')[0],
      status: 'active',
    });
    console.log(`   ✅ After alert created`);

    // Test 6: Get active after alerts
    console.log('6. Testing getActiveAfterAlerts query...');
    const activeAlerts = await getActiveAfterAlerts();
    const foundAlert = activeAlerts.find(a => a.id === afterAlertId);
    console.log(`   ✅ Active after alerts query: ${foundAlert ? 'SUCCESS' : 'FAILED'}`);
    console.log(`   📊 Active alerts found: ${activeAlerts.length}`);

    // Test 7: Delete alert
    console.log('7. Deleting alert...');
    const deleteSuccess = await deleteAlert(testAlertId);
    console.log(`   ✅ Alert deleted: ${deleteSuccess ? 'SUCCESS' : 'FAILED'}`);
    if (!deleteSuccess) throw new Error('Failed to delete alert');

    const deletedAlert = await getAlertById(testAlertId);
    console.log(`   ✅ Deleted alert check: ${deletedAlert === null ? 'SUCCESS' : 'FAILED'}`);

    return { testAlertId, afterAlertId };
  } catch (error) {
    console.error('   ❌ Alert operations test failed:', error);
    throw error;
  }
}

async function testDataIntegrity(testUserId: string) {
  console.log('\n🧪 Testing Data Integrity (Cascade Delete)...\n');

  const cascadeUserId = `cascade-user-${Date.now()}`;
  const cascadeUserEmail = `cascade-${Date.now()}@example.com`;
  const testPasswordHash = 'test_hash_12345';

  try {
    // Create user with alerts
    console.log('1. Creating user with alerts...');
    await createUser({
      id: cascadeUserId,
      email: cascadeUserEmail,
      passwordHash: testPasswordHash,
      emailVerified: false,
    });

    const alertId = `cascade-alert-${Date.now()}`;
    const earningsDate = new Date();
    earningsDate.setDate(earningsDate.getDate() + 7);

    await createAlert({
      id: alertId,
      userId: cascadeUserId,
      symbol: 'GOOGL',
      alertType: 'before',
      daysBefore: 1,
      recurring: false,
      earningsDate: earningsDate.toISOString().split('T')[0],
      status: 'active',
    });
    console.log(`   ✅ User and alert created`);

    // Verify alert exists
    const alertBefore = await getAlertById(alertId);
    console.log(`   ✅ Alert exists before delete: ${alertBefore ? 'SUCCESS' : 'FAILED'}`);

    // Delete user (should cascade delete alerts)
    console.log('2. Deleting user (should cascade delete alerts)...');
    const deleteSuccess = await deleteUser(cascadeUserId);
    console.log(`   ✅ User deleted: ${deleteSuccess ? 'SUCCESS' : 'FAILED'}`);

    // Verify user is deleted
    const userAfter = await getUserById(cascadeUserId);
    console.log(`   ✅ User deleted check: ${userAfter === null ? 'SUCCESS' : 'FAILED'}`);

    // Verify alert is also deleted (cascade)
    const alertAfter = await getAlertById(alertId);
    console.log(`   ✅ Alert cascade deleted: ${alertAfter === null ? 'SUCCESS' : 'FAILED'}`);

    if (alertAfter !== null) {
      throw new Error('Alert was not cascade deleted');
    }
  } catch (error) {
    console.error('   ❌ Data integrity test failed:', error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting D1 Migration Integration Tests\n');
  console.log('=' .repeat(60));

  let testUserId: string | undefined;
  let testUserEmail: string | undefined;

  try {
    // Test user operations
    const userTestResult = await testUserOperations();
    testUserId = userTestResult.testUserId;
    testUserEmail = userTestResult.testUserEmail;

    // Test alert operations
    await testAlertOperations(testUserId);

    // Test data integrity
    await testDataIntegrity(testUserId);

    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests passed!\n');

    // Cleanup
    console.log('🧹 Cleaning up test data...');
    if (testUserId) {
      await deleteUser(testUserId);
      console.log('   ✅ Test user deleted');
    }

    console.log('\n🎉 Migration verification complete!\n');
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('❌ Tests failed:', error);
    
    // Cleanup on error
    if (testUserId) {
      console.log('\n🧹 Cleaning up test data...');
      try {
        await deleteUser(testUserId);
        console.log('   ✅ Test user deleted');
      } catch (cleanupError) {
        console.error('   ⚠️  Cleanup error:', cleanupError);
      }
    }

    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { testUserOperations, testAlertOperations, testDataIntegrity };


