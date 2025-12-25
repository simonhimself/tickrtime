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
import { saveVerificationToken } from '@/lib/kv-dev-edge';
import { createKV } from '@/lib/kv-factory';
import { createUser as createUserInDB, getUserByEmail } from '@/lib/db/users';
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

    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json<AuthResponse>({
        success: false,
        message: 'User with this email already exists'
      }, { status: 409 });
    }

    // Hash password
    const passwordHash = await hashPasswordAsync(password);

    // Create user object
    const user = createUser(email, passwordHash);

    // Email verification control
    // Check environment variable to determine if verification is required
    const shouldSendEmails = process.env.SEND_VERIFICATION_EMAILS === 'true';
    
    let emailVerified = false;
    let verificationToken: string | undefined = user.verificationToken;
    
    if (!shouldSendEmails) {
      // Development mode with emails disabled - auto-verify
      emailVerified = true;
      verificationToken = undefined;
    }

    // Save user to D1
    logger.debug('Attempting to save user to D1:', user.id, user.email);
    try {
      const saved = await createUserInDB({
        id: user.id,
        email: user.email,
        passwordHash: user.passwordHash,
        emailVerified,
        notificationPreferences: undefined,
      });
      logger.debug('Save result:', saved);
      if (!saved) {
        logger.error('createUserInDB returned false - user was not saved');
        return NextResponse.json<AuthResponse>({
          success: false,
          message: 'Failed to create user. Please ensure you are using "npx wrangler dev" for D1 database support.'
        }, { status: 500 });
      }
    } catch (dbError) {
      logger.error('Database error during user creation:', dbError);
      if (dbError instanceof Error && dbError.message.includes('D1 database not available')) {
        return NextResponse.json<AuthResponse>({
          success: false,
          message: 'Database not available. Please use "npx wrangler dev" instead of "npm run dev" to run the server with D1 support.'
        }, { status: 500 });
      }
      return NextResponse.json<AuthResponse>({
        success: false,
        message: 'Failed to create user: ' + (dbError instanceof Error ? dbError.message : 'Unknown error')
      }, { status: 500 });
    }

    // Save verification token to KV (temporary data, stays in KV)
    if (verificationToken) {
      const kv = createKV();
      await saveVerificationToken(kv, verificationToken, user.id, 24 * 3600); // 24 hours
    }

    // Send verification email (only if verification is required)
    if (verificationToken && shouldSendEmails) {
      logger.debug('Attempting to send verification email to:', user.email);
      const emailSent = await sendVerificationEmail({
        email: user.email,
        token: verificationToken,
        userName: user.email.split('@')[0] // Use email prefix as username
      });
      
      if (!emailSent) {
        logger.warn('Failed to send verification email, but user was created');
      } else {
        logger.debug('Verification email sent successfully to:', user.email);
      }
    } else {
      logger.debug('Email verification skipped. Token exists:', !!verificationToken, 'Should send:', shouldSendEmails);
    }

    // Generate JWT token
    const userForToken = {
      id: user.id,
      email: user.email,
      emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    const token = await generateToken(userForToken);

    return NextResponse.json<AuthResponse>({
      success: true,
      message: 'User created successfully. Please check your email to verify your account.',
      user: userForToken,
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
