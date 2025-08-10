import { NextRequest, NextResponse } from 'next/server';
import { 
  hashPassword, 
  isValidEmail, 
  isValidPassword, 
  createUser,
  generateToken,
  kvUserToUser
} from '@/lib/auth';
import { saveUser, saveVerificationToken, createDevKV } from '@/lib/kv-dev';
import type { SignupRequest, AuthResponse } from '@/types';

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

    // Get KV namespace (use development KV for now)
    const kv = createDevKV();

    // Check if user already exists
    const existingUser = await import('@/lib/kv-dev').then(m => m.getUserByEmail(kv, email));
    if (existingUser) {
      return NextResponse.json<AuthResponse>({
        success: false,
        message: 'User with this email already exists'
      }, { status: 409 });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = createUser(email, passwordHash);

    // Save user to KV
    console.log('Attempting to save user:', user.id, user.email);
    const saved = await saveUser(kv, user);
    console.log('Save result:', saved);
    if (!saved) {
      return NextResponse.json<AuthResponse>({
        success: false,
        message: 'Failed to create user'
      }, { status: 500 });
    }

    // Save verification token
    if (user.verificationToken) {
      await saveVerificationToken(kv, user.verificationToken, user.id, 24 * 3600); // 24 hours
    }

    // TODO: Send verification email
    // For now, we'll just log the verification token
    console.log('Verification token:', user.verificationToken);

    // Generate JWT token
    const token = generateToken(kvUserToUser(user));

    return NextResponse.json<AuthResponse>({
      success: true,
      message: 'User created successfully. Please check your email to verify your account.',
      user: kvUserToUser(user),
      token
    }, { status: 201 });

  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json<AuthResponse>({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}
