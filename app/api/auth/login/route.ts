import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import type { AuthRequest, AuthResponse } from '@/types';

import { 
  verifyPasswordAsync, 
  isValidEmail, 
  generateToken,
  kvUserToUser
} from '@/lib/auth';
import { getUserByEmail } from '@/lib/kv-dev-edge';
import { createKV } from '@/lib/kv-factory';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const body: AuthRequest = await request.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json<AuthResponse>({
        success: false,
        message: 'Email and password are required'
      }, { status: 400 });
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return NextResponse.json<AuthResponse>({
        success: false,
        message: 'Invalid email format'
      }, { status: 400 });
    }

    // Get KV namespace
    const kv = createKV();

    // Get user by email
    console.log('Login attempt for email:', email);
    const user = await getUserByEmail(kv, email);
    console.log('User lookup result:', user ? 'Found' : 'Not found');
    if (!user) {
      return NextResponse.json<AuthResponse>({
        success: false,
        message: 'Invalid email or password'
      }, { status: 401 });
    }

    // Verify password
    console.log('Verifying password for user:', user.email);
    const isValid = await verifyPasswordAsync(password, user.passwordHash);
    console.log('Password verification result:', isValid);
    if (!isValid) {
      return NextResponse.json<AuthResponse>({
        success: false,
        message: 'Invalid email or password'
      }, { status: 401 });
    }

    // Check if email is verified
    console.log('Email verification status:', user.emailVerified);
    if (!user.emailVerified) {
      return NextResponse.json<AuthResponse>({
        success: false,
        message: 'Please verify your email before logging in'
      }, { status: 403 });
    }

    // Generate JWT token
    const token = await generateToken(kvUserToUser(user));

    return NextResponse.json<AuthResponse>({
      success: true,
      message: 'Login successful',
      user: kvUserToUser(user),
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json<AuthResponse>({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}
