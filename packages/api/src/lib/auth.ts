import { generateUUID, hashPassword, verifyPassword, signJWT, verifyJWT } from './crypto';
import type { User } from '@tickrtime/shared';
import type { KVUser } from './db/users';

export { type KVUser, type NotificationPreferences } from './db/users';
export { type KVAlert } from './db/alerts';

export function generateVerificationToken(): string {
  return generateUUID();
}

export async function hashPasswordAsync(password: string): Promise<string> {
  return hashPassword(password);
}

export async function verifyPasswordAsync(password: string, hash: string): Promise<boolean> {
  return verifyPassword(password, hash);
}

export async function generateToken(user: User, jwtSecret: string): Promise<string> {
  return signJWT(
    { 
      userId: user.id, 
      email: user.email,
      emailVerified: user.emailVerified 
    },
    jwtSecret
  );
}

export async function verifyToken(token: string, jwtSecret: string): Promise<{ userId: string; email: string; emailVerified: boolean } | null> {
  try {
    const decoded = await verifyJWT(token, jwtSecret);
    if (!decoded) return null;
    
    return {
      userId: decoded.userId as string,
      email: decoded.email as string,
      emailVerified: decoded.emailVerified as boolean
    };
  } catch {
    return null;
  }
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPassword(password: string): { valid: boolean; message: string } {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  
  if (!/(?=.*[a-z])/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  
  if (!/(?=.*[A-Z])/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  
  if (!/(?=.*\d)/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  
  return { valid: true, message: 'Password is valid' };
}

export function kvUserToUser(kvUser: KVUser): User {
  return {
    id: kvUser.id,
    email: kvUser.email,
    emailVerified: kvUser.emailVerified,
    createdAt: kvUser.createdAt,
    updatedAt: kvUser.updatedAt,
  };
}

export function createUser(email: string, passwordHash: string): KVUser {
  const now = new Date().toISOString();
  return {
    id: generateUUID(),
    email: email.toLowerCase(),
    passwordHash,
    emailVerified: false,
    verificationToken: generateVerificationToken(),
    createdAt: now,
    updatedAt: now,
  };
}





