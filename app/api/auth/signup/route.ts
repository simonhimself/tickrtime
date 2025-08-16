import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

import type { SignupRequest, AuthResponse } from '@/types';

import { 
  hashPasswordAsync, 
  isValidEmail, 
  isValidPassword, 
  createUser,
  generateToken,
  kvUserToUser
} from '@/lib/auth';
import { saveUser, saveVerificationToken, getUserByEmail } from '@/lib/kv-dev-edge';
import { createKV } from '@/lib/kv-factory';
import { sendVerificationEmail } from '@/lib/email';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const body: SignupRequest = await request.json();
    const { email, password, confirmPassword } = body;

    // Validate input
    if (!email || !password || !confirmPassword) {
      return NextResponse.json<AuthResponse>({
        success: false,
        message: 'Email, password, and confirm password are required'
      }, { status: 400 });
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return NextResponse.json<AuthResponse>({
        success: false,
        message: 'Invalid email format'
      }, { status: 400 });
    }

    // Validate password strength
    const passwordValidation = isValidPassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json<AuthResponse>({
        success: false,
        message: passwordValidation.message
      }, { status: 400 });
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      return NextResponse.json<AuthResponse>({
        success: false,
        message: 'Passwords do not match'
      }, { status: 400 });
    }

    // Get KV namespace
    const kv = createKV();

    // Check if user already exists
    const existingUser = await getUserByEmail(kv, email);
    if (existingUser) {
      return NextResponse.json<AuthResponse>({
        success: false,
        message: 'User with this email already exists'
      }, { status: 409 });
    }

    // Hash password
    const passwordHash = await hashPasswordAsync(password);

    // Create user
    const user = createUser(email, passwordHash);

    // Email verification control
    // Check environment variable to determine if verification is required
    const shouldSendEmails = process.env.SEND_VERIFICATION_EMAILS === 'true';
    
    if (!shouldSendEmails) {
      // Development mode with emails disabled - auto-verify
      user.emailVerified = true;
      user.verificationToken = undefined;
    }
    // Otherwise, keep verification token and send email

    // Save user to KV
    logger.debug('Attempting to save user:', user.id, user.email);
    const saved = await saveUser(kv, user);
    logger.debug('Save result:', saved);
    if (!saved) {
      return NextResponse.json<AuthResponse>({
        success: false,
        message: 'Failed to create user'
      }, { status: 500 });
    }

    // Save verification token (only in production)
    if (user.verificationToken) {
      await saveVerificationToken(kv, user.verificationToken, user.id, 24 * 3600); // 24 hours
    }

    // Send verification email (only if verification is required)
    if (user.verificationToken && shouldSendEmails) {
      logger.debug('Attempting to send verification email to:', user.email);
      const emailSent = await sendVerificationEmail({
        email: user.email,
        token: user.verificationToken,
        userName: user.email.split('@')[0] // Use email prefix as username
      });
      
      if (!emailSent) {
        logger.warn('Failed to send verification email, but user was created');
      } else {
        logger.debug('Verification email sent successfully to:', user.email);
      }
    } else {
      logger.debug('Email verification skipped. Token exists:', !!user.verificationToken, 'Should send:', shouldSendEmails);
    }

    // Generate JWT token
    const token = await generateToken(kvUserToUser(user));

    return NextResponse.json<AuthResponse>({
      success: true,
      message: 'User created successfully. Please check your email to verify your account.',
      user: kvUserToUser(user),
      token
    }, { status: 201 });

  } catch (error) {
    logger.error('Signup error:', error);
    return NextResponse.json<AuthResponse>({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}
