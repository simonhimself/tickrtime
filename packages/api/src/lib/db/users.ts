import type { D1Database } from '@cloudflare/workers-types';
import { logger } from '../logger';

export interface KVUser {
  id: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  verificationToken?: string;
  notificationPreferences?: NotificationPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreferences {
  emailEnabled: boolean;
  defaultDaysBefore: number;
  defaultDaysAfter: number;
}

export interface UserRow {
  id: string;
  email: string;
  email_normalized: string;
  password_hash: string;
  email_verified: number;
  notification_preferences: string | null;
  created_at: string;
  updated_at: string;
}

function rowToKVUser(row: UserRow): KVUser {
  let notificationPreferences: NotificationPreferences | undefined;
  if (row.notification_preferences) {
    try {
      notificationPreferences = JSON.parse(row.notification_preferences);
    } catch (error) {
      logger.warn('Failed to parse notification preferences:', error);
    }
  }

  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    emailVerified: row.email_verified === 1,
    notificationPreferences,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getUserById(db: D1Database, userId: string): Promise<KVUser | null> {
  try {
    const result = await db
      .prepare('SELECT * FROM users WHERE id = ?')
      .bind(userId)
      .first<UserRow>();

    if (!result) {
      return null;
    }

    return rowToKVUser(result);
  } catch (error) {
    logger.error('Error getting user by ID:', error);
    return null;
  }
}

export async function getUserByEmail(db: D1Database, email: string): Promise<KVUser | null> {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    const result = await db
      .prepare('SELECT * FROM users WHERE email_normalized = ?')
      .bind(normalizedEmail)
      .first<UserRow>();

    if (!result) {
      return null;
    }

    return rowToKVUser(result);
  } catch (error) {
    logger.error('Error getting user by email:', error);
    return null;
  }
}

export async function createUser(
  db: D1Database,
  user: {
    id: string;
    email: string;
    passwordHash: string;
    emailVerified?: boolean;
    notificationPreferences?: NotificationPreferences;
  }
): Promise<boolean> {
  try {
    const now = new Date().toISOString();
    const normalizedEmail = user.email.toLowerCase().trim();
    const notificationPrefs = user.notificationPreferences
      ? JSON.stringify(user.notificationPreferences)
      : null;

    const result = await db
      .prepare(
        `INSERT INTO users (id, email, email_normalized, password_hash, email_verified, notification_preferences, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        user.id,
        user.email,
        normalizedEmail,
        user.passwordHash,
        user.emailVerified ? 1 : 0,
        notificationPrefs,
        now,
        now
      )
      .run();

    if (!result.success) {
      logger.error('Database insert failed:', result);
      return false;
    }
    
    return result.meta.changes > 0;
  } catch (error) {
    logger.error('Error creating user:', error);
    if (error instanceof Error) {
      logger.error('Error message:', error.message);
      logger.error('Error stack:', error.stack);
    }
    return false;
  }
}

export async function updateUser(
  db: D1Database,
  userId: string,
  updates: {
    email?: string;
    passwordHash?: string;
    emailVerified?: boolean;
    notificationPreferences?: NotificationPreferences;
  }
): Promise<boolean> {
  try {
    const now = new Date().toISOString();

    const fields: string[] = ['updated_at = ?'];
    const values: unknown[] = [now];

    if (updates.email !== undefined) {
      fields.push('email = ?', 'email_normalized = ?');
      values.push(updates.email, updates.email.toLowerCase().trim());
    }
    if (updates.passwordHash !== undefined) {
      fields.push('password_hash = ?');
      values.push(updates.passwordHash);
    }
    if (updates.emailVerified !== undefined) {
      fields.push('email_verified = ?');
      values.push(updates.emailVerified ? 1 : 0);
    }
    if (updates.notificationPreferences !== undefined) {
      fields.push('notification_preferences = ?');
      values.push(JSON.stringify(updates.notificationPreferences));
    }

    values.push(userId);

    const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
    const result = await db.prepare(query).bind(...values).run();

    return result.success && result.meta.changes > 0;
  } catch (error) {
    logger.error('Error updating user:', error);
    return false;
  }
}

export async function deleteUser(db: D1Database, userId: string): Promise<boolean> {
  try {
    const result = await db
      .prepare('DELETE FROM users WHERE id = ?')
      .bind(userId)
      .run();

    return result.success && result.meta.changes > 0;
  } catch (error) {
    logger.error('Error deleting user:', error);
    return false;
  }
}





