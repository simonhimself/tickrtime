import { Resend } from 'resend';
import { logger } from '@/lib/logger';

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

export interface EarningsAlertData {
  email: string;
  symbol: string;
  companyName?: string;
  earningsDate: string;
  daysUntil?: number;
  daysAfter?: number;
  alertType: 'before' | 'after';
  actual?: number | null;
  estimate?: number | null;
  surprise?: number | null;
  surprisePercent?: number | null;
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
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://tickrtime-3vf.pages.dev'}/verify-email?token=${data.token}" class="button">
              Verify Email Address
            </a>
          </div>
          
          <p>Or copy and paste this link into your browser:</p>
          <div class="code">
            ${process.env.NEXT_PUBLIC_APP_URL || 'https://tickrtime-3vf.pages.dev'}/verify-email?token=${data.token}
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
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://tickrtime-3vf.pages.dev'}/reset-password?token=${data.token}" class="button">
              Reset Password
            </a>
          </div>
          
          <p>Or copy and paste this link into your browser:</p>
          <div class="code">
            ${process.env.NEXT_PUBLIC_APP_URL || 'https://tickrtime-3vf.pages.dev'}/reset-password?token=${data.token}
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
      logger.warn('RESEND_API_KEY not set, skipping email send');
      return false;
    }

    const emailData = createVerificationEmail(data);
    const result = await resend.emails.send(emailData);
    
    logger.debug('Verification email sent:', result);
    
    // Check if email was sent successfully
    if (result.error) {
      logger.error('Resend error:', result.error);
      return false;
    }
    
    return true;
  } catch (error) {
    logger.error('Failed to send verification email:', error);
    return false;
  }
}

// Send password reset email
export async function sendPasswordResetEmail(data: PasswordResetData): Promise<boolean> {
  try {
    if (!resend) {
      logger.warn('RESEND_API_KEY not set, skipping email send');
      return false;
    }

    const emailData = createPasswordResetEmail(data);
    const result = await resend.emails.send(emailData);
    
    logger.debug('Password reset email sent:', result);
    return true;
  } catch (error) {
    logger.error('Failed to send password reset email:', error);
    return false;
  }
}

// Earnings alert email template (before earnings)
const createBeforeEarningsAlertEmail = (data: EarningsAlertData) => ({
  from: 'TickrTime <onboarding@resend.dev>',
  to: data.email,
  subject: `Earnings Alert: ${data.symbol} reporting in ${data.daysUntil} day${data.daysUntil !== 1 ? 's' : ''}`,
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Earnings Alert - ${data.symbol}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .info-box { background: #e9ecef; padding: 15px; border-radius: 6px; margin: 20px 0; }
        .symbol { font-size: 24px; font-weight: bold; color: #667eea; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎯 TickrTime</h1>
          <p>Earnings Alert</p>
        </div>
        <div class="content">
          <h2>Upcoming Earnings: ${data.symbol}</h2>
          <p>Hi ${data.userName || 'there'},</p>
          <p>This is a reminder that <strong>${data.companyName || data.symbol}</strong> (${data.symbol}) is scheduled to report earnings soon.</p>
          
          <div class="info-box">
            <div class="symbol">${data.symbol}</div>
            <p><strong>Earnings Date:</strong> ${new Date(data.earningsDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p><strong>Days Until Earnings:</strong> ${data.daysUntil} day${data.daysUntil !== 1 ? 's' : ''}</p>
          </div>
          
          <div style="text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://tickrtime-3vf.pages.dev'}" class="button">
              View Earnings Details
            </a>
          </div>
          
          <p>Stay informed and never miss important earnings announcements!</p>
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

// Earnings alert email template (after earnings)
const createAfterEarningsAlertEmail = (data: EarningsAlertData) => ({
  from: 'TickrTime <onboarding@resend.dev>',
  to: data.email,
  subject: `Earnings Results: ${data.symbol} has reported`,
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Earnings Results - ${data.symbol}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .info-box { background: #e9ecef; padding: 15px; border-radius: 6px; margin: 20px 0; }
        .symbol { font-size: 24px; font-weight: bold; color: #667eea; }
        .positive { color: #28a745; font-weight: bold; }
        .negative { color: #dc3545; font-weight: bold; }
        .results-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .results-table td { padding: 10px; border-bottom: 1px solid #dee2e6; }
        .results-table td:first-child { font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎯 TickrTime</h1>
          <p>Earnings Results</p>
        </div>
        <div class="content">
          <h2>Earnings Reported: ${data.symbol}</h2>
          <p>Hi ${data.userName || 'there'},</p>
          <p><strong>${data.companyName || data.symbol}</strong> (${data.symbol}) has reported earnings.</p>
          
          <div class="info-box">
            <div class="symbol">${data.symbol}</div>
            <p><strong>Earnings Date:</strong> ${new Date(data.earningsDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          
          ${data.actual !== null || data.estimate !== null || data.surprise !== null ? `
          <table class="results-table">
            ${data.estimate !== null ? `<tr><td>Estimate:</td><td>$${data.estimate.toFixed(2)}</td></tr>` : ''}
            ${data.actual !== null ? `<tr><td>Actual:</td><td>$${data.actual.toFixed(2)}</td></tr>` : ''}
            ${data.surprise !== null ? `<tr><td>Surprise:</td><td class="${data.surprise >= 0 ? 'positive' : 'negative'}">${data.surprise >= 0 ? '+' : ''}$${data.surprise.toFixed(2)}</td></tr>` : ''}
            ${data.surprisePercent !== null ? `<tr><td>Surprise %:</td><td class="${data.surprisePercent >= 0 ? 'positive' : 'negative'}">${data.surprisePercent >= 0 ? '+' : ''}${data.surprisePercent.toFixed(2)}%</td></tr>` : ''}
          </table>
          ` : '<p>Earnings results are being processed. Check back soon for detailed information.</p>'}
          
          <div style="text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://tickrtime-3vf.pages.dev'}" class="button">
              View Full Details
            </a>
          </div>
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

// Send earnings alert email (before earnings - can be scheduled)
export async function sendEarningsAlertEmail(
  data: EarningsAlertData,
  scheduledAt?: string
): Promise<{ success: boolean; emailId?: string; error?: string }> {
  try {
    if (!resend) {
      logger.warn('RESEND_API_KEY not set, skipping email send');
      return { success: false, error: 'Email service not configured' };
    }

    const emailData = data.alertType === 'before' 
      ? createBeforeEarningsAlertEmail(data)
      : createAfterEarningsAlertEmail(data);

    // Add scheduledAt if provided (for "before" alerts)
    const emailPayload: any = {
      ...emailData,
    };

    if (scheduledAt) {
      emailPayload.scheduledAt = scheduledAt;
    }

    const result = await resend.emails.send(emailPayload);
    
    logger.debug('Earnings alert email sent:', result);
    
    if (result.error) {
      logger.error('Resend error:', result.error);
      return { success: false, error: result.error.message || 'Failed to send email' };
    }
    
    return { 
      success: true, 
      emailId: result.data?.id 
    };
  } catch (error) {
    logger.error('Failed to send earnings alert email:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Test email service
export async function testEmailService(email: string): Promise<boolean> {
  try {
    if (!resend) {
      logger.warn('RESEND_API_KEY not set, cannot test email service');
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
    
    logger.debug('Test email sent:', result);
    return true;
  } catch (error) {
    logger.error('Failed to send test email:', error);
    return false;
  }
}
