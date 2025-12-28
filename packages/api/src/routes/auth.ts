import { Hono } from 'hono';
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
import { getUserByEmail, getUserById, createUser as createUserInDB, updateUser, deleteUser } from '../lib/db/users';
import { deleteAllUserAlerts } from '../lib/db/alerts';
import {
  saveVerificationToken,
  getVerificationToken,
  deleteVerificationToken,
  savePasswordResetToken,
  getPasswordResetToken,
  deletePasswordResetToken,
  deleteWatchlist,
} from '../lib/kv';
import { sendVerificationEmail, sendPasswordResetEmail, cancelScheduledEmail } from '../lib/email';
import { generateUUID } from '../lib/crypto';
import type { SignupRequest, AuthResponse, AuthRequest } from '@tickrtime/shared';

const app = new Hono<{ Bindings: Env }>();
const logger = createLogger('auth');

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

    const db = createDB(c.env!);

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

    // Email verification control - use SEND_VERIFICATION_EMAILS env var
    // Set to "true" to require email verification, "false" to auto-verify
    const shouldSendEmails = c.env!.SEND_VERIFICATION_EMAILS === 'true';
    
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
      await saveVerificationToken(c.env!.TICKRTIME_KV, verificationToken, user.id, 24 * 3600); // 24 hours
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
        c.env!.RESEND_API_KEY,
        c.env!.NEXT_PUBLIC_APP_URL
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
    const token = await generateToken(userForToken, c.env!.JWT_SECRET);

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

    const db = createDB(c.env!);

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
    const token = await generateToken(kvUserToUser(user), c.env!.JWT_SECRET);

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
    const userData = await verifyToken(token, c.env!.JWT_SECRET);
    if (!userData) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    const db = createDB(c.env!);

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
    const userId = await getVerificationToken(c.env!.TICKRTIME_KV, token);
    
    if (!userId) {
      return c.json<AuthResponse>({
        success: false,
        message: 'Invalid or expired verification token'
      }, 400);
    }

    const db = createDB(c.env!);

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
    await deleteVerificationToken(c.env!.TICKRTIME_KV, token);
    
    // Get updated user
    const updatedUser = await getUserById(db, userId);
    if (!updatedUser) {
      return c.json<AuthResponse>({
        success: false,
        message: 'Failed to retrieve updated user'
      }, 500);
    }

    // Generate JWT token
    const jwtToken = await generateToken(kvUserToUser(updatedUser), c.env!.JWT_SECRET);

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

// POST /api/auth/forgot-password
app.post('/forgot-password', async (c) => {
  try {
    const body = await c.req.json<{ email: string }>();
    const { email } = body;

    // Validate input
    if (!email) {
      return c.json<AuthResponse>({
        success: false,
        message: 'Email is required'
      }, 400);
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return c.json<AuthResponse>({
        success: false,
        message: 'Invalid email format'
      }, 400);
    }

    const db = createDB(c.env!);

    // Check if user exists
    const user = await getUserByEmail(db, email);

    // Always return success to prevent email enumeration
    // But only send email if user exists
    if (user) {
      // Generate password reset token
      const resetToken = generateUUID();

      // Save token to KV with 1-hour TTL
      await savePasswordResetToken(c.env!.TICKRTIME_KV, resetToken, user.id, 3600);

      // Send password reset email
      const emailSent = await sendPasswordResetEmail(
        {
          email: user.email,
          token: resetToken,
          userName: user.email.split('@')[0]
        },
        c.env!.RESEND_API_KEY,
        c.env!.NEXT_PUBLIC_APP_URL
      );

      if (!emailSent) {
        logger.warn('Failed to send password reset email to:', email);
      } else {
        logger.debug('Password reset email sent to:', email);
      }
    } else {
      logger.debug('Password reset requested for non-existent email:', email);
    }

    // Always return success to prevent email enumeration
    return c.json<AuthResponse>({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    });

  } catch (error) {
    logger.error('Forgot password error:', error);
    return c.json<AuthResponse>({
      success: false,
      message: 'Internal server error'
    }, 500);
  }
});

// POST /api/auth/reset-password
app.post('/reset-password', async (c) => {
  try {
    const body = await c.req.json<{ token: string; newPassword: string }>();
    const { token, newPassword } = body;

    // Validate input
    if (!token || !newPassword) {
      return c.json<AuthResponse>({
        success: false,
        message: 'Token and new password are required'
      }, 400);
    }

    // Validate password strength
    const passwordValidation = isValidPassword(newPassword);
    if (!passwordValidation.valid) {
      return c.json<AuthResponse>({
        success: false,
        message: passwordValidation.message
      }, 400);
    }

    // Get user ID from token
    const userId = await getPasswordResetToken(c.env!.TICKRTIME_KV, token);

    if (!userId) {
      return c.json<AuthResponse>({
        success: false,
        message: 'Invalid or expired reset token'
      }, 400);
    }

    const db = createDB(c.env!);

    // Verify user exists
    const user = await getUserById(db, userId);
    if (!user) {
      return c.json<AuthResponse>({
        success: false,
        message: 'User not found'
      }, 404);
    }

    // Hash new password
    const newPasswordHash = await hashPasswordAsync(newPassword);

    // Update user password in D1
    const updated = await updateUser(db, userId, {
      passwordHash: newPasswordHash,
    });

    if (!updated) {
      return c.json<AuthResponse>({
        success: false,
        message: 'Failed to update password'
      }, 500);
    }

    // Delete reset token from KV
    await deletePasswordResetToken(c.env!.TICKRTIME_KV, token);

    logger.debug('Password reset successfully for user:', userId);

    return c.json<AuthResponse>({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.'
    });

  } catch (error) {
    logger.error('Reset password error:', error);
    return c.json<AuthResponse>({
      success: false,
      message: 'Internal server error'
    }, 500);
  }
});

// POST /api/auth/resend-verification
app.post('/resend-verification', async (c) => {
  try {
    const body = await c.req.json<{ email: string }>();
    const { email } = body;

    // Validate input
    if (!email) {
      return c.json<AuthResponse>({
        success: false,
        message: 'Email is required'
      }, 400);
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return c.json<AuthResponse>({
        success: false,
        message: 'Invalid email format'
      }, 400);
    }

    const db = createDB(c.env!);

    // Get user by email
    const user = await getUserByEmail(db, email);

    // Check if user exists
    if (!user) {
      // Return success to prevent email enumeration
      return c.json<AuthResponse>({
        success: true,
        message: 'If an unverified account with that email exists, a verification link has been sent.'
      });
    }

    // Check if already verified
    if (user.emailVerified) {
      return c.json<AuthResponse>({
        success: false,
        message: 'Email is already verified'
      }, 400);
    }

    // Generate new verification token
    const verificationToken = generateUUID();

    // Save verification token to KV with 24-hour TTL
    await saveVerificationToken(c.env!.TICKRTIME_KV, verificationToken, user.id, 24 * 3600);

    // Send verification email
    const emailSent = await sendVerificationEmail(
      {
        email: user.email,
        token: verificationToken,
        userName: user.email.split('@')[0]
      },
      c.env!.RESEND_API_KEY,
      c.env!.NEXT_PUBLIC_APP_URL
    );

    if (!emailSent) {
      logger.warn('Failed to resend verification email to:', email);
      return c.json<AuthResponse>({
        success: false,
        message: 'Failed to send verification email. Please try again later.'
      }, 500);
    }

    logger.debug('Verification email resent to:', email);

    return c.json<AuthResponse>({
      success: true,
      message: 'If an unverified account with that email exists, a verification link has been sent.'
    });

  } catch (error) {
    logger.error('Resend verification error:', error);
    return c.json<AuthResponse>({
      success: false,
      message: 'Internal server error'
    }, 500);
  }
});

// POST /api/auth/change-password - Change password for authenticated user
app.post('/change-password', async (c) => {
  try {
    // Get token from Authorization header
    const authHeader = c.req.header('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json<AuthResponse>({
        success: false,
        message: 'No authorization token provided'
      }, 401);
    }

    const token = authHeader.substring(7);

    // Verify the token
    const userData = await verifyToken(token, c.env!.JWT_SECRET);
    if (!userData) {
      return c.json<AuthResponse>({
        success: false,
        message: 'Invalid or expired token'
      }, 401);
    }

    const body = await c.req.json<{ currentPassword: string; newPassword: string }>();
    const { currentPassword, newPassword } = body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return c.json<AuthResponse>({
        success: false,
        message: 'Current password and new password are required'
      }, 400);
    }

    // Validate new password strength
    const passwordValidation = isValidPassword(newPassword);
    if (!passwordValidation.valid) {
      return c.json<AuthResponse>({
        success: false,
        message: passwordValidation.message
      }, 400);
    }

    const db = createDB(c.env!);

    // Get user from D1
    const user = await getUserById(db, userData.userId);
    if (!user) {
      return c.json<AuthResponse>({
        success: false,
        message: 'User not found'
      }, 404);
    }

    // Verify current password
    const isValid = await verifyPasswordAsync(currentPassword, user.passwordHash);
    if (!isValid) {
      return c.json<AuthResponse>({
        success: false,
        message: 'Current password is incorrect'
      }, 401);
    }

    // Hash new password
    const newPasswordHash = await hashPasswordAsync(newPassword);

    // Update user password in D1
    const updated = await updateUser(db, userData.userId, {
      passwordHash: newPasswordHash,
    });

    if (!updated) {
      return c.json<AuthResponse>({
        success: false,
        message: 'Failed to update password'
      }, 500);
    }

    logger.debug('Password changed successfully for user:', userData.userId);

    return c.json<AuthResponse>({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    logger.error('Change password error:', error);
    return c.json<AuthResponse>({
      success: false,
      message: 'Internal server error'
    }, 500);
  }
});

// DELETE /api/auth/account - Delete user account and all associated data
app.delete('/account', async (c) => {
  try {
    // Get token from Authorization header
    const authHeader = c.req.header('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json<AuthResponse>({
        success: false,
        message: 'No authorization token provided'
      }, 401);
    }

    const token = authHeader.substring(7);

    // Verify the token
    const userData = await verifyToken(token, c.env!.JWT_SECRET);
    if (!userData) {
      return c.json<AuthResponse>({
        success: false,
        message: 'Invalid or expired token'
      }, 401);
    }

    const db = createDB(c.env!);
    const userId = userData.userId;

    // Verify user exists
    const user = await getUserById(db, userId);
    if (!user) {
      return c.json<AuthResponse>({
        success: false,
        message: 'User not found'
      }, 404);
    }

    logger.info('Starting account deletion for user:', userId);

    // Step 1: Delete all alerts and get scheduled email IDs
    const alertsResult = await deleteAllUserAlerts(db, userId);
    logger.debug('Deleted alerts:', alertsResult.deleted, 'Scheduled emails to cancel:', alertsResult.scheduledEmailIds.length);

    // Step 2: Cancel any scheduled emails via Resend API
    if (alertsResult.scheduledEmailIds.length > 0 && c.env!.RESEND_API_KEY) {
      const cancelResults = await Promise.allSettled(
        alertsResult.scheduledEmailIds.map(emailId =>
          cancelScheduledEmail(emailId, c.env!.RESEND_API_KEY)
        )
      );

      const successCount = cancelResults.filter(r => r.status === 'fulfilled' && r.value.success).length;
      logger.debug('Cancelled scheduled emails:', successCount, '/', alertsResult.scheduledEmailIds.length);
    }

    // Step 3: Delete watchlist from KV
    await deleteWatchlist(c.env!.TICKRTIME_KV, userId);
    logger.debug('Deleted watchlist for user:', userId);

    // Step 4: Delete user from D1
    const userDeleted = await deleteUser(db, userId);
    if (!userDeleted) {
      logger.error('Failed to delete user from database:', userId);
      return c.json<AuthResponse>({
        success: false,
        message: 'Failed to delete account'
      }, 500);
    }

    logger.info('Account deletion completed for user:', userId);

    return c.json<AuthResponse>({
      success: true,
      message: 'Account and all associated data have been deleted successfully'
    });

  } catch (error) {
    logger.error('Account deletion error:', error);
    return c.json<AuthResponse>({
      success: false,
      message: 'Internal server error'
    }, 500);
  }
});

export default app;





