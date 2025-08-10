import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import type { AuthResponse } from '@/types';

import { generateToken, kvUserToUser } from '@/lib/auth';
import { getUserById, updateUser, getVerificationToken, deleteVerificationToken } from '@/lib/kv-dev-edge';
import { createKV } from '@/lib/kv-factory';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json<AuthResponse>({
        success: false,
        message: 'Verification token is required'
      }, { status: 400 });
    }

    // Get KV namespace
    const kv = createKV();

    // Get verification token
    console.log('Verifying token:', token);
    const userId = await getVerificationToken(kv, token);
    console.log('Token lookup result:', userId);
    
    if (!userId) {
      return NextResponse.json<AuthResponse>({
        success: false,
        message: 'Invalid or expired verification token'
      }, { status: 400 });
    }

    // Get user
    console.log('Looking up user with ID:', userId);
    const user = await getUserById(kv, userId);
    console.log('User lookup result:', user ? 'Found' : 'Not found');
    if (!user) {
      return NextResponse.json<AuthResponse>({
        success: false,
        message: 'User not found'
      }, { status: 404 });
    }

    // Check if already verified
    if (user.emailVerified) {
      return NextResponse.json<AuthResponse>({
        success: false,
        message: 'Email is already verified'
      }, { status: 400 });
    }

    // Update user to verified
    user.emailVerified = true;
    user.verificationToken = undefined;
    user.updatedAt = new Date().toISOString();

    const updated = await updateUser(kv, user);
    if (!updated) {
      return NextResponse.json<AuthResponse>({
        success: false,
        message: 'Failed to verify email'
      }, { status: 500 });
    }

    // Delete verification token
    await deleteVerificationToken(kv, token);

    // Generate JWT token
    const jwtToken = await generateToken(kvUserToUser(user));

    return NextResponse.json<AuthResponse>({
      success: true,
      message: 'Email verified successfully',
      user: kvUserToUser(user),
      token: jwtToken
    });

  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.json<AuthResponse>({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}
