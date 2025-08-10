import { NextRequest, NextResponse } from 'next/server';
import { 
  verifyPassword, 
  isValidEmail, 
  generateToken,
  kvUserToUser
} from '@/lib/auth';
import { getUserByEmail } from '@/lib/kv';
import type { AuthRequest, AuthResponse } from '@/types';

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
    const kv = (request as any).env?.TICKRTIME_KV;
    if (!kv) {
      return NextResponse.json<AuthResponse>({
        success: false,
        message: 'Database not available'
      }, { status: 500 });
    }

    // Get user by email
    const user = await getUserByEmail(kv, email);
    if (!user) {
      return NextResponse.json<AuthResponse>({
        success: false,
        message: 'Invalid email or password'
      }, { status: 401 });
    }

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json<AuthResponse>({
        success: false,
        message: 'Invalid email or password'
      }, { status: 401 });
    }

    // Check if email is verified
    if (!user.emailVerified) {
      return NextResponse.json<AuthResponse>({
        success: false,
        message: 'Please verify your email before logging in'
      }, { status: 403 });
    }

    // Generate JWT token
    const token = generateToken(kvUserToUser(user));

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
