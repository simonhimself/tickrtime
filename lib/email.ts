import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export interface EmailVerificationData {
  email: string;
  token: string;
  userName?: string;
}

export interface PasswordResetData {
  email: string;
  token: string;
  userName?: string;
}

// Email verification template
const createVerificationEmail = (data: EmailVerificationData) => ({
  from: 'TickrTime <onboarding@resend.dev>',
  to: data.email,
  subject: 'Verify your TickrTime account',
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify your TickrTime account</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .code { background: #e9ecef; padding: 10px; border-radius: 4px; font-family: monospace; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎯 TickrTime</h1>
          <p>Verify your email address</p>
        </div>
        <div class="content">
          <h2>Welcome to TickrTime!</h2>
          <p>Hi ${data.userName || 'there'},</p>
          <p>Thanks for signing up for TickrTime! To complete your registration and start tracking earnings, please verify your email address.</p>
          
          <div style="text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3003'}/verify-email?token=${data.token}" class="button">
              Verify Email Address
            </a>
          </div>
          
          <p>Or copy and paste this link into your browser:</p>
          <div class="code">
            ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3003'}/verify-email?token=${data.token}
          </div>
          
          <p><strong>This link will expire in 24 hours.</strong></p>
          
          <p>If you didn't create a TickrTime account, you can safely ignore this email.</p>
        </div>
        <div class="footer">
          <p>© 2024 TickrTime. Never miss earnings again.</p>
          <p>This email was sent to ${data.email}</p>
        </div>
      </div>
    </body>
    </html>
  `
});

// Password reset template
const createPasswordResetEmail = (data: PasswordResetData) => ({
  from: 'TickrTime <onboarding@resend.dev>',
  to: data.email,
  subject: 'Reset your TickrTime password',
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset your TickrTime password</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .code { background: #e9ecef; padding: 10px; border-radius: 4px; font-family: monospace; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎯 TickrTime</h1>
          <p>Reset your password</p>
        </div>
        <div class="content">
          <h2>Password Reset Request</h2>
          <p>Hi ${data.userName || 'there'},</p>
          <p>We received a request to reset your TickrTime password. Click the button below to create a new password:</p>
          
          <div style="text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3003'}/reset-password?token=${data.token}" class="button">
              Reset Password
            </a>
          </div>
          
          <p>Or copy and paste this link into your browser:</p>
          <div class="code">
            ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3003'}/reset-password?token=${data.token}
          </div>
          
          <p><strong>This link will expire in 1 hour.</strong></p>
          
          <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
        </div>
        <div class="footer">
          <p>© 2024 TickrTime. Never miss earnings again.</p>
          <p>This email was sent to ${data.email}</p>
        </div>
      </div>
    </body>
    </html>
  `
});

// Send verification email
export async function sendVerificationEmail(data: EmailVerificationData): Promise<boolean> {
  try {
    if (!resend) {
      console.warn('RESEND_API_KEY not set, skipping email send');
      return false;
    }

    const emailData = createVerificationEmail(data);
    const result = await resend.emails.send(emailData);
    
    console.log('Verification email sent:', result);
    
    // Check if email was sent successfully
    if (result.error) {
      console.error('Resend error:', result.error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Failed to send verification email:', error);
    return false;
  }
}

// Send password reset email
export async function sendPasswordResetEmail(data: PasswordResetData): Promise<boolean> {
  try {
    if (!resend) {
      console.warn('RESEND_API_KEY not set, skipping email send');
      return false;
    }

    const emailData = createPasswordResetEmail(data);
    const result = await resend.emails.send(emailData);
    
    console.log('Password reset email sent:', result);
    return true;
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return false;
  }
}

// Test email service
export async function testEmailService(email: string): Promise<boolean> {
  try {
    if (!resend) {
      console.warn('RESEND_API_KEY not set, cannot test email service');
      return false;
    }

    const result = await resend.emails.send({
      from: 'TickrTime <onboarding@resend.dev>',
      to: email,
      subject: 'TickrTime Email Service Test',
      html: `
        <h1>Email Service Test</h1>
        <p>This is a test email from TickrTime to verify the email service is working correctly.</p>
        <p>If you received this email, the email service is configured properly!</p>
      `
    });
    
    console.log('Test email sent:', result);
    return true;
  } catch (error) {
    console.error('Failed to send test email:', error);
    return false;
  }
}
