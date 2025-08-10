import { generateUUID, hashPassword, verifyPassword, signJWT, verifyJWT } from './crypto-edge';
import type { User } from '@/types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface KVUser {
  id: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  verificationToken?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KVWatchlist {
  tickers: string[];
  lastUpdated: string;
}

// Generate a secure random token for email verification
export function generateVerificationToken(): string {
  return generateUUID();
}

// Hash password (now async)
export async function hashPasswordAsync(password: string): Promise<string> {
  return hashPassword(password);
}

// Verify password (now async)
export async function verifyPasswordAsync(password: string, hash: string): Promise<boolean> {
  return verifyPassword(password, hash);
}

// Generate JWT token (now async)
export async function generateToken(user: User): Promise<string> {
  return signJWT(
    { 
      userId: user.id, 
      email: user.email,
      emailVerified: user.emailVerified 
    },
    JWT_SECRET
  );
}

// Verify JWT token (now async)
export async function verifyToken(token: string): Promise<{ userId: string; email: string; emailVerified: boolean } | null> {
  try {
    const decoded = await verifyJWT(token, JWT_SECRET);
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

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate password strength
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

// Convert KV user to API user
export function kvUserToUser(kvUser: KVUser): User {
  return {
    id: kvUser.id,
    email: kvUser.email,
    emailVerified: kvUser.emailVerified,
    createdAt: kvUser.createdAt,
    updatedAt: kvUser.updatedAt,
  };
}

// Create new user object
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
