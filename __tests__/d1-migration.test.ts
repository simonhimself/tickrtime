/**
 * Tests for D1 Migration
 * 
 * These tests verify that the migration from KV to D1 works correctly.
 * Run with: npm test
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createDB } from '../lib/db';
import { createUser, getUserById, getUserByEmail, updateUser, deleteUser } from '../lib/db/users';
import { createAlert, getUserAlerts, getAlertById, updateAlert, deleteAlert, getActiveAfterAlerts } from '../lib/db/alerts';
import { hashPasswordAsync } from '../lib/auth';

describe('D1 Migration Tests', () => {
  let testUserId: string;
  let testUserEmail: string;
  const testPasswordHash = 'test_hash';

  beforeAll(async () => {
    // Generate test user data
    testUserId = `test-user-${Date.now()}`;
    testUserEmail = `test-${Date.now()}@example.com`;
  });

  describe('User Operations', () => {
    it('should create a user in D1', async () => {
      const success = await createUser({
        id: testUserId,
        email: testUserEmail,
        passwordHash: testPasswordHash,
        emailVerified: false,
      });

      expect(success).toBe(true);
    });

    it('should get user by ID', async () => {
      const user = await getUserById(testUserId);
      
      expect(user).not.toBeNull();
      expect(user?.id).toBe(testUserId);
      expect(user?.email).toBe(testUserEmail);
      expect(user?.emailVerified).toBe(false);
    });

    it('should get user by email (normalized)', async () => {
      const user = await getUserByEmail(testUserEmail.toUpperCase());
      
      expect(user).not.toBeNull();
      expect(user?.id).toBe(testUserId);
      expect(user?.email).toBe(testUserEmail);
    });

    it('should update user', async () => {
      const success = await updateUser(testUserId, {
        emailVerified: true,
        notificationPreferences: {
          emailEnabled: true,
          defaultDaysBefore: 2,
          defaultDaysAfter: 1,
        },
      });

      expect(success).toBe(true);

      const updatedUser = await getUserById(testUserId);
      expect(updatedUser?.emailVerified).toBe(true);
      expect(updatedUser?.notificationPreferences?.emailEnabled).toBe(true);
      expect(updatedUser?.notificationPreferences?.defaultDaysBefore).toBe(2);
    });

    it('should not find non-existent user', async () => {
      const user = await getUserById('non-existent-id');
      expect(user).toBeNull();
    });
  });

  describe('Alert Operations', () => {
    let testAlertId: string;

    it('should create an alert in D1', async () => {
      testAlertId = `test-alert-${Date.now()}`;
      const earningsDate = new Date();
      earningsDate.setDate(earningsDate.getDate() + 7); // 7 days from now

      const success = await createAlert({
        id: testAlertId,
        userId: testUserId,
        symbol: 'AAPL',
        alertType: 'before',
        daysBefore: 1,
        recurring: false,
        earningsDate: earningsDate.toISOString().split('T')[0],
        status: 'active',
      });

      expect(success).toBe(true);
    });

    it('should get alert by ID', async () => {
      const alert = await getAlertById(testAlertId);
      
      expect(alert).not.toBeNull();
      expect(alert?.id).toBe(testAlertId);
      expect(alert?.userId).toBe(testUserId);
      expect(alert?.symbol).toBe('AAPL');
      expect(alert?.alertType).toBe('before');
      expect(alert?.daysBefore).toBe(1);
    });

    it('should get user alerts', async () => {
      const alerts = await getUserAlerts(testUserId);
      
      expect(alerts.length).toBeGreaterThan(0);
      const alert = alerts.find(a => a.id === testAlertId);
      expect(alert).not.toBeUndefined();
    });

    it('should update alert', async () => {
      const success = await updateAlert(testAlertId, {
        daysBefore: 2,
        status: 'active',
      });

      expect(success).toBe(true);

      const updatedAlert = await getAlertById(testAlertId);
      expect(updatedAlert?.daysBefore).toBe(2);
    });

    it('should create "after" alert for cron job test', async () => {
      const afterAlertId = `test-after-alert-${Date.now()}`;
      const earningsDate = new Date();
      earningsDate.setDate(earningsDate.getDate() - 1); // Yesterday

      const success = await createAlert({
        id: afterAlertId,
        userId: testUserId,
        symbol: 'MSFT',
        alertType: 'after',
        daysAfter: 0,
        recurring: false,
        earningsDate: earningsDate.toISOString().split('T')[0],
        status: 'active',
      });

      expect(success).toBe(true);

      // Test getActiveAfterAlerts query
      const activeAlerts = await getActiveAfterAlerts();
      const foundAlert = activeAlerts.find(a => a.id === afterAlertId);
      expect(foundAlert).not.toBeUndefined();
    });

    it('should delete alert', async () => {
      const success = await deleteAlert(testAlertId);
      expect(success).toBe(true);

      const deletedAlert = await getAlertById(testAlertId);
      expect(deletedAlert).toBeNull();
    });
  });

  describe('Data Integrity', () => {
    it('should enforce foreign key constraints (cascade delete)', async () => {
      // Create a user with alerts
      const cascadeUserId = `cascade-user-${Date.now()}`;
      const cascadeUserEmail = `cascade-${Date.now()}@example.com`;
      
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

      // Verify alert exists
      const alertBefore = await getAlertById(alertId);
      expect(alertBefore).not.toBeNull();

      // Delete user (should cascade delete alerts)
      await deleteUser(cascadeUserId);

      // Verify user is deleted
      const userAfter = await getUserById(cascadeUserId);
      expect(userAfter).toBeNull();

      // Verify alert is also deleted (cascade)
      const alertAfter = await getAlertById(alertId);
      expect(alertAfter).toBeNull();
    });
  });

  afterAll(async () => {
    // Cleanup: delete test user (will cascade delete alerts)
    if (testUserId) {
      await deleteUser(testUserId);
    }
  });
});


