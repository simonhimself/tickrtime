/**
 * Comprehensive tests for all user functions
 * 
 * Tests cover:
 * - getUserById
 * - getUserByEmail
 * - createUser
 * - updateUser
 * - deleteUser
 * - Edge cases and error handling
 */

// Mock the db module BEFORE any imports - order matters!
jest.mock('@cloudflare/next-on-pages', () => ({
  getRequestContext: jest.fn(() => {
    throw new Error('Not in Cloudflare context');
  }),
}));

// Create shared mock database instance - must be outside mock factory
const { MockD1Database } = require('./mock-d1-database');
const sharedMockDbInstance = new MockD1Database();

// Set up test database in globalThis before any imports
(globalThis as any).__TEST_DB__ = sharedMockDbInstance;

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import type { D1Database } from '../lib/db';
import * as dbModule from '../lib/db';
import {
  getUserById,
  getUserByEmail,
  createUser,
  updateUser,
  deleteUser,
} from '../lib/db/users';
import type { NotificationPreferences } from '../lib/auth';
import { MockD1Database as MockDB } from './mock-d1-database';

// Get the mock database instance
let mockD1Db: MockD1Database;


describe('User Functions Tests', () => {
  let testUserId1: string;
  let testUserId2: string;
  let testEmail1: string;
  let testEmail2: string;
  const testPasswordHash = 'hashed_password_123';

  beforeAll(() => {
    // Use the shared mock database instance
    mockD1Db = sharedMockDbInstance as MockDB;
  });

  beforeEach(() => {
    // Clean up before each test
    if (mockD1Db instanceof MockDB) {
      mockD1Db.clear();
    }
    
    // Generate unique test data
    const timestamp = Date.now();
    testUserId1 = `test-user-1-${timestamp}`;
    testUserId2 = `test-user-2-${timestamp}`;
    testEmail1 = `test1-${timestamp}@example.com`;
    testEmail2 = `test2-${timestamp}@example.com`;
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    it('should create a user with minimal required fields', async () => {
      // Test createUser directly
      const success = await createUser({
        id: testUserId1,
        email: testEmail1,
        passwordHash: testPasswordHash,
      });

      expect(success).toBe(true);

      // Verify user was created
      const user = await getUserById(testUserId1);
      expect(user).not.toBeNull();
      expect(user?.id).toBe(testUserId1);
      expect(user?.email).toBe(testEmail1);
      expect(user?.passwordHash).toBe(testPasswordHash);
      expect(user?.emailVerified).toBe(false);
      expect(user?.createdAt).toBeDefined();
      expect(user?.updatedAt).toBeDefined();
    });

    it('should create a user with all optional fields', async () => {
      const notificationPrefs: NotificationPreferences = {
        emailEnabled: true,
        defaultDaysBefore: 2,
        defaultDaysAfter: 1,
      };

      const success = await createUser({
        id: testUserId1,
        email: testEmail1,
        passwordHash: testPasswordHash,
        emailVerified: true,
        notificationPreferences: notificationPrefs,
      });

      expect(success).toBe(true);

      const user = await getUserById(testUserId1);
      expect(user?.emailVerified).toBe(true);
      expect(user?.notificationPreferences).toEqual(notificationPrefs);
    });

    it('should normalize email to lowercase', async () => {
      const mixedCaseEmail = 'Test.User@EXAMPLE.COM';
      
      const success = await createUser({
        id: testUserId1,
        email: mixedCaseEmail,
        passwordHash: testPasswordHash,
      });

      expect(success).toBe(true);

      // Should be able to find by any case variation
      const user1 = await getUserByEmail(mixedCaseEmail.toLowerCase());
      const user2 = await getUserByEmail(mixedCaseEmail.toUpperCase());
      const user3 = await getUserByEmail(mixedCaseEmail);

      expect(user1).not.toBeNull();
      expect(user2).not.toBeNull();
      expect(user3).not.toBeNull();
      expect(user1?.email).toBe(mixedCaseEmail.toLowerCase());
    });

    it('should trim whitespace from email', async () => {
      const emailWithSpaces = '  test@example.com  ';
      
      const success = await createUser({
        id: testUserId1,
        email: emailWithSpaces,
        passwordHash: testPasswordHash,
      });

      expect(success).toBe(true);

      const user = await getUserByEmail('test@example.com');
      expect(user).not.toBeNull();
      expect(user?.email).toBe('test@example.com');
    });

    it('should fail when creating duplicate user (same ID)', async () => {
      await createUser({
        id: testUserId1,
        email: testEmail1,
        passwordHash: testPasswordHash,
      });

      // Try to create again with same ID
      const success = await createUser({
        id: testUserId1,
        email: testEmail2,
        passwordHash: testPasswordHash,
      });

      // Should fail (primary key constraint)
      expect(success).toBe(false);
    });

    it('should fail when creating duplicate user (same email)', async () => {
      await createUser({
        id: testUserId1,
        email: testEmail1,
        passwordHash: testPasswordHash,
      });

      // Try to create again with same email
      const success = await createUser({
        id: testUserId2,
        email: testEmail1,
        passwordHash: testPasswordHash,
      });

      // Should fail (unique constraint on email)
      expect(success).toBe(false);
    });

    it('should handle JSON notification preferences correctly', async () => {
      const complexPrefs: NotificationPreferences = {
        emailEnabled: false,
        defaultDaysBefore: 5,
        defaultDaysAfter: 3,
      };

      await createUser({
        id: testUserId1,
        email: testEmail1,
        passwordHash: testPasswordHash,
        notificationPreferences: complexPrefs,
      });

      const user = await getUserById(testUserId1);
      expect(user?.notificationPreferences).toEqual(complexPrefs);
    });
  });

  describe('getUserById', () => {
    beforeEach(async () => {
      await createUser({
        id: testUserId1,
        email: testEmail1,
        passwordHash: testPasswordHash,
      });
    });

    it('should retrieve user by ID', async () => {
      const user = await getUserById(testUserId1);

      expect(user).not.toBeNull();
      expect(user?.id).toBe(testUserId1);
      expect(user?.email).toBe(testEmail1);
      expect(user?.passwordHash).toBe(testPasswordHash);
    });

    it('should return null for non-existent user', async () => {
      const user = await getUserById('non-existent-id');
      expect(user).toBeNull();
    });

    it('should return null for empty string ID', async () => {
      const user = await getUserById('');
      expect(user).toBeNull();
    });
  });

  describe('getUserByEmail', () => {
    beforeEach(async () => {
      await createUser({
        id: testUserId1,
        email: testEmail1,
        passwordHash: testPasswordHash,
      });
    });

    it('should retrieve user by email (exact match)', async () => {
      const user = await getUserByEmail(testEmail1);

      expect(user).not.toBeNull();
      expect(user?.id).toBe(testUserId1);
      expect(user?.email).toBe(testEmail1);
    });

    it('should retrieve user by email (case-insensitive)', async () => {
      const user1 = await getUserByEmail(testEmail1.toUpperCase());
      const user2 = await getUserByEmail(testEmail1.toLowerCase());

      expect(user1).not.toBeNull();
      expect(user2).not.toBeNull();
      expect(user1?.id).toBe(testUserId1);
      expect(user2?.id).toBe(testUserId1);
    });

    it('should normalize email before lookup', async () => {
      const user = await getUserByEmail(`  ${testEmail1.toUpperCase()}  `);

      expect(user).not.toBeNull();
      expect(user?.id).toBe(testUserId1);
    });

    it('should return null for non-existent email', async () => {
      const user = await getUserByEmail('nonexistent@example.com');
      expect(user).toBeNull();
    });

    it('should return null for empty email', async () => {
      const user = await getUserByEmail('');
      expect(user).toBeNull();
    });
  });

  describe('updateUser', () => {
    beforeEach(async () => {
      await createUser({
        id: testUserId1,
        email: testEmail1,
        passwordHash: testPasswordHash,
        emailVerified: false,
      });
    });

    it('should update email', async () => {
      const newEmail = 'newemail@example.com';
      const success = await updateUser(testUserId1, { email: newEmail });

      expect(success).toBe(true);

      const user = await getUserById(testUserId1);
      expect(user?.email).toBe(newEmail);
      
      // Should be findable by new email
      const userByEmail = await getUserByEmail(newEmail);
      expect(userByEmail?.id).toBe(testUserId1);
    });

    it('should update password hash', async () => {
      const newPasswordHash = 'new_hashed_password';
      const success = await updateUser(testUserId1, { passwordHash: newPasswordHash });

      expect(success).toBe(true);

      const user = await getUserById(testUserId1);
      expect(user?.passwordHash).toBe(newPasswordHash);
    });

    it('should update emailVerified status', async () => {
      const success = await updateUser(testUserId1, { emailVerified: true });

      expect(success).toBe(true);

      const user = await getUserById(testUserId1);
      expect(user?.emailVerified).toBe(true);
    });

    it('should update notification preferences', async () => {
      const newPrefs: NotificationPreferences = {
        emailEnabled: true,
        defaultDaysBefore: 3,
        defaultDaysAfter: 2,
      };

      const success = await updateUser(testUserId1, {
        notificationPreferences: newPrefs,
      });

      expect(success).toBe(true);

      const user = await getUserById(testUserId1);
      expect(user?.notificationPreferences).toEqual(newPrefs);
    });

    it('should update multiple fields at once', async () => {
      const newEmail = 'updated@example.com';
      const newPrefs: NotificationPreferences = {
        emailEnabled: true,
        defaultDaysBefore: 1,
        defaultDaysAfter: 1,
      };

      const success = await updateUser(testUserId1, {
        email: newEmail,
        emailVerified: true,
        notificationPreferences: newPrefs,
      });

      expect(success).toBe(true);

      const user = await getUserById(testUserId1);
      expect(user?.email).toBe(newEmail);
      expect(user?.emailVerified).toBe(true);
      expect(user?.notificationPreferences).toEqual(newPrefs);
    });

    it('should update updated_at timestamp', async () => {
      const userBefore = await getUserById(testUserId1);
      const originalUpdatedAt = userBefore?.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      await updateUser(testUserId1, { emailVerified: true });

      const userAfter = await getUserById(testUserId1);
      expect(userAfter?.updatedAt).not.toBe(originalUpdatedAt);
    });

    it('should return false for non-existent user', async () => {
      const success = await updateUser('non-existent-id', { emailVerified: true });
      expect(success).toBe(false);
    });

    it('should handle empty update object gracefully', async () => {
      // This should still update updated_at
      const success = await updateUser(testUserId1, {});
      expect(success).toBe(true);
    });

    it('should normalize email when updating', async () => {
      const mixedCaseEmail = 'UPDATED@EXAMPLE.COM';
      await updateUser(testUserId1, { email: mixedCaseEmail });

      const user = await getUserByEmail(mixedCaseEmail.toLowerCase());
      expect(user).not.toBeNull();
      expect(user?.email).toBe(mixedCaseEmail.toLowerCase());
    });
  });

  describe('deleteUser', () => {
    beforeEach(async () => {
      await createUser({
        id: testUserId1,
        email: testEmail1,
        passwordHash: testPasswordHash,
      });
    });

    it('should delete user by ID', async () => {
      const success = await deleteUser(testUserId1);

      expect(success).toBe(true);

      const user = await getUserById(testUserId1);
      expect(user).toBeNull();
    });

    it('should return false for non-existent user', async () => {
      const success = await deleteUser('non-existent-id');
      expect(success).toBe(false);
    });

    it('should cascade delete related alerts', async () => {
      // Create an alert for the user using the mock database
      await mockD1Db.prepare(`
        INSERT INTO alerts (id, user_id, symbol, alert_type, days_before, recurring, earnings_date, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        'test-alert-1',
        testUserId1,
        'AAPL',
        'before',
        1,
        0,
        '2024-12-31',
        'active',
        new Date().toISOString(),
        new Date().toISOString()
      ).run();

      // Verify alert exists
      const alertBefore = await mockD1Db.prepare('SELECT * FROM alerts WHERE user_id = ?').bind(testUserId1).first();
      expect(alertBefore).not.toBeNull();

      // Delete user
      await deleteUser(testUserId1);

      // Verify alert was cascade deleted
      const alertAfter = await mockD1Db.prepare('SELECT * FROM alerts WHERE user_id = ?').bind(testUserId1).first();
      expect(alertAfter).toBeNull();
    });
  });

  describe('Integration Tests', () => {
    it('should handle full user lifecycle', async () => {
      // Create
      const createSuccess = await createUser({
        id: testUserId1,
        email: testEmail1,
        passwordHash: testPasswordHash,
      });
      expect(createSuccess).toBe(true);

      // Read
      const user1 = await getUserById(testUserId1);
      expect(user1).not.toBeNull();

      // Update
      const updateSuccess = await updateUser(testUserId1, { emailVerified: true });
      expect(updateSuccess).toBe(true);

      const user2 = await getUserById(testUserId1);
      expect(user2?.emailVerified).toBe(true);

      // Delete
      const deleteSuccess = await deleteUser(testUserId1);
      expect(deleteSuccess).toBe(true);

      const user3 = await getUserById(testUserId1);
      expect(user3).toBeNull();
    });

    it('should handle multiple users independently', async () => {
      // Create two users
      await createUser({
        id: testUserId1,
        email: testEmail1,
        passwordHash: testPasswordHash,
      });

      await createUser({
        id: testUserId2,
        email: testEmail2,
        passwordHash: testPasswordHash,
      });

      // Verify both exist
      const user1 = await getUserById(testUserId1);
      const user2 = await getUserById(testUserId2);
      expect(user1).not.toBeNull();
      expect(user2).not.toBeNull();

      // Update one
      await updateUser(testUserId1, { emailVerified: true });
      const updatedUser1 = await getUserById(testUserId1);
      const unchangedUser2 = await getUserById(testUserId2);

      expect(updatedUser1?.emailVerified).toBe(true);
      expect(unchangedUser2?.emailVerified).toBe(false);

      // Delete one
      await deleteUser(testUserId1);
      const deletedUser1 = await getUserById(testUserId1);
      const remainingUser2 = await getUserById(testUserId2);

      expect(deletedUser1).toBeNull();
      expect(remainingUser2).not.toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid notification preferences JSON gracefully', async () => {
      // Create user first
      await createUser({
        id: testUserId1,
        email: testEmail1,
        passwordHash: testPasswordHash,
      });

      // Manually insert invalid JSON to test parsing error handling
      await mockD1Db.prepare(`
        UPDATE users 
        SET notification_preferences = ? 
        WHERE id = ?
      `).bind('invalid json', testUserId1).run();

      // Should handle gracefully and return user without preferences
      const user = await getUserById(testUserId1);
      expect(user).not.toBeNull();
      // Preferences should be undefined due to parse error
      expect(user?.notificationPreferences).toBeUndefined();
    });
  });
});

