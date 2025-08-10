import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import type { User } from '@/types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const SALT_ROUNDS = 12;

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
  return randomUUID();
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Generate JWT token
export function generateToken(user: User): string {
  return jwt.sign(
    { 
      userId: user.id, 
      email: user.email,
      emailVerified: user.emailVerified 
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Verify JWT token
export function verifyToken(token: string): { userId: string; email: string; emailVerified: boolean } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      userId: decoded.userId,
      email: decoded.email,
      emailVerified: decoded.emailVerified
    };
  } catch (error) {
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
    id: randomUUID(),
    email: email.toLowerCase(),
    passwordHash,
    emailVerified: false,
    verificationToken: generateVerificationToken(),
    createdAt: now,
    updatedAt: now,
  };
}
