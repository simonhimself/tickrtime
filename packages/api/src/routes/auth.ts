import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import { createLogger } from '../lib/logger';
import {
  hashPasswordAsync,
  isValidEmail,
  isValidPassword,
  createUser,
  generateToken,
  verifyToken,
  verifyPasswordAsync,
  kvUserToUser,
} from '../lib/auth';
import { createDB } from '../lib/db';
import { getUserByEmail, getUserById, createUser as createUserInDB, updateUser } from '../lib/db/users';
import { saveVerificationToken, getVerificationToken, deleteVerificationToken } from '../lib/kv';
import { sendVerificationEmail } from '../lib/email';
import type { SignupRequest, AuthResponse, AuthRequest } from '@tickrtime/shared';

const app = new Hono<{ Bindings: Env }>();
const logger = createLogger('auth');

// Signup schema
const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  confirmPassword: z.string().min(8),
});

// Login schema
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/auth/signup
app.post('/signup', async (c) => {
  try {
    const body = await c.req.json<SignupRequest>();
    const { email, password, confirmPassword } = body;

    // Validate input
    if (!email || !password || !confirmPassword) {
      return c.json<AuthResponse>({
        success: false,
        message: 'Email, password, and confirm password are required'
      }, 400);
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return c.json<AuthResponse>({
        success: false,
        message: 'Invalid email format'
      }, 400);
    }

    // Validate password strength
    const passwordValidation = isValidPassword(password);
    if (!passwordValidation.valid) {
      return c.json<AuthResponse>({
        success: false,
        message: passwordValidation.message
      }, 400);
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      return c.json<AuthResponse>({
        success: false,
        message: 'Passwords do not match'
      }, 400);
    }

    const db = createDB(c.env);

    // Check if user already exists
    const existingUser = await getUserByEmail(db, email);
    if (existingUser) {
      return c.json<AuthResponse>({
        success: false,
        message: 'User with this email already exists'
      }, 409);
    }

    // Hash password
    const passwordHash = await hashPasswordAsync(password);

    // Create user object
    const user = createUser(email, passwordHash);

    // Email verification control
    const shouldSendEmails = c.env.NODE_ENV === 'production';
    
    let emailVerified = false;
    let verificationToken: string | undefined = user.verificationToken;
    
    if (!shouldSendEmails) {
      // Development mode - auto-verify
      emailVerified = true;
      verificationToken = undefined;
    }

    // Save user to D1
    logger.debug('Attempting to save user to D1:', user.id, user.email);
    const saved = await createUserInDB(db, {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      emailVerified,
      notificationPreferences: undefined,
    });
    
    if (!saved) {
      logger.error('createUserInDB returned false - user was not saved');
      return c.json<AuthResponse>({
        success: false,
        message: 'Failed to create user'
      }, 500);
    }

    // Save verification token to KV (temporary data, stays in KV)
    if (verificationToken) {
      await saveVerificationToken(c.env.TICKRTIME_KV, verificationToken, user.id, 24 * 3600); // 24 hours
    }

    // Send verification email (only if verification is required)
    if (verificationToken && shouldSendEmails) {
      logger.debug('Attempting to send verification email to:', user.email);
      const emailSent = await sendVerificationEmail(
        {
          email: user.email,
          token: verificationToken,
          userName: user.email.split('@')[0]
        },
        c.env.RESEND_API_KEY,
        c.env.NEXT_PUBLIC_APP_URL
      );
      
      if (!emailSent) {
        logger.warn('Failed to send verification email, but user was created');
      } else {
        logger.debug('Verification email sent successfully to:', user.email);
      }
    }

    // Generate JWT token
    const userForToken = {
      id: user.id,
      email: user.email,
      emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    const token = await generateToken(userForToken, c.env.JWT_SECRET);

    return c.json<AuthResponse>({
      success: true,
      message: 'User created successfully. Please check your email to verify your account.',
      user: userForToken,
      token
    }, 201);

  } catch (error) {
    logger.error('Signup error:', error);
    return c.json<AuthResponse>({
      success: false,
      message: 'Internal server error'
    }, 500);
  }
});

// POST /api/auth/login
app.post('/login', async (c) => {
  try {
    const body = await c.req.json<AuthRequest>();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return c.json<AuthResponse>({
        success: false,
        message: 'Email and password are required'
      }, 400);
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return c.json<AuthResponse>({
        success: false,
        message: 'Invalid email format'
      }, 400);
    }

    const db = createDB(c.env);

    // Get user by email from D1
    logger.debug('Login attempt for email:', email);
    const user = await getUserByEmail(db, email);
    
    if (!user) {
      return c.json<AuthResponse>({
        success: false,
        message: 'Invalid email or password'
      }, 401);
    }

    // Verify password
    const isValid = await verifyPasswordAsync(password, user.passwordHash);
    if (!isValid) {
      return c.json<AuthResponse>({
        success: false,
        message: 'Invalid email or password'
      }, 401);
    }

    // Check if email is verified
    if (!user.emailVerified) {
      return c.json<AuthResponse>({
        success: false,
        message: 'Please verify your email before logging in'
      }, 403);
    }

    // Generate JWT token
    const token = await generateToken(kvUserToUser(user), c.env.JWT_SECRET);

    return c.json<AuthResponse>({
      success: true,
      message: 'Login successful',
      user: kvUserToUser(user),
      token
    });

  } catch (error) {
    logger.error('Login error:', error);
    return c.json<AuthResponse>({
      success: false,
      message: 'Internal server error'
    }, 500);
  }
});

// GET /api/auth/me
app.get('/me', async (c) => {
  try {
    // Get token from Authorization header
    const authHeader = c.req.header('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'No authorization token provided' }, 401);
    }

    const token = authHeader.substring(7);
    
    // Verify the token
    const userData = await verifyToken(token, c.env.JWT_SECRET);
    if (!userData) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    const db = createDB(c.env);

    // Get full user data from D1
    const user = await getUserById(db, userData.userId);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Return user data
    return c.json({
      user: kvUserToUser(user)
    });
  } catch (error) {
    logger.error('Error verifying auth:', error);
    return c.json({ error: 'Authentication failed' }, 401);
  }
});

// GET /api/auth/verify-email
app.get('/verify-email', async (c) => {
  try {
    const token = c.req.query('token');

    if (!token) {
      return c.json<AuthResponse>({
        success: false,
        message: 'Verification token is required'
      }, 400);
    }

    // Get verification token from KV
    logger.debug('Verifying token:', token);
    const userId = await getVerificationToken(c.env.TICKRTIME_KV, token);
    
    if (!userId) {
      return c.json<AuthResponse>({
        success: false,
        message: 'Invalid or expired verification token'
      }, 400);
    }

    const db = createDB(c.env);

    // Get user from D1
    const user = await getUserById(db, userId);
    if (!user) {
      return c.json<AuthResponse>({
        success: false,
        message: 'User not found'
      }, 404);
    }

    // Check if already verified
    if (user.emailVerified) {
      return c.json<AuthResponse>({
        success: false,
        message: 'Email is already verified'
      }, 400);
    }

    // Update user to verified in D1
    const updated = await updateUser(db, userId, {
      emailVerified: true,
    });
    
    if (!updated) {
      return c.json<AuthResponse>({
        success: false,
        message: 'Failed to verify email'
      }, 500);
    }

    // Delete verification token from KV
    await deleteVerificationToken(c.env.TICKRTIME_KV, token);
    
    // Get updated user
    const updatedUser = await getUserById(db, userId);
    if (!updatedUser) {
      return c.json<AuthResponse>({
        success: false,
        message: 'Failed to retrieve updated user'
      }, 500);
    }

    // Generate JWT token
    const jwtToken = await generateToken(kvUserToUser(updatedUser), c.env.JWT_SECRET);

    return c.json<AuthResponse>({
      success: true,
      message: 'Email verified successfully',
      user: kvUserToUser(updatedUser),
      token: jwtToken
    });

  } catch (error) {
    logger.error('Email verification error:', error);
    return c.json<AuthResponse>({
      success: false,
      message: 'Internal server error'
    }, 500);
  }
});

export default app;

