/**
 * Test script to send sample "before" and "after" earnings alert emails
 *
 * Usage:
 *   cd packages/api
 *   npx tsx scripts/send-test-emails.ts
 *
 * Requires RESEND_API_KEY in .dev.vars or environment
 */

import { Resend } from 'resend';
import * as fs from 'fs';
import * as path from 'path';

// Load .dev.vars if it exists
const devVarsPath = path.join(__dirname, '..', '.dev.vars');
if (fs.existsSync(devVarsPath)) {
  const devVars = fs.readFileSync(devVarsPath, 'utf-8');
  devVars.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TEST_EMAIL = 'simonhimself@gmail.com';
const APP_URL = 'https://tickrtime.pages.dev';

if (!RESEND_API_KEY) {
  console.error('Error: RESEND_API_KEY not found in environment or .dev.vars');
  process.exit(1);
}

const resend = new Resend(RESEND_API_KEY);

// Sample data for test emails
const sampleData = {
  symbol: 'AAPL',
  companyName: 'Apple Inc.',
  earningsDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!, // 3 days from now
  userName: 'Simon',
};

async function sendBeforeEmail() {
  console.log('Sending "before" earnings alert email...');

  const earningsDate = new Date(sampleData.earningsDate);
  const formattedDate = earningsDate.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const result = await resend.emails.send({
    from: 'TickrTime <onboarding@resend.dev>',
    to: TEST_EMAIL,
    subject: `Earnings Alert: ${sampleData.symbol} reporting in 3 days`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Earnings Alert - ${sampleData.symbol}</title>
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
            <h1>TickrTime</h1>
            <p>Earnings Alert</p>
          </div>
          <div class="content">
            <h2>Upcoming Earnings: ${sampleData.symbol}</h2>
            <p>Hi ${sampleData.userName},</p>
            <p>This is a reminder that <strong>${sampleData.companyName}</strong> (${sampleData.symbol}) is scheduled to report earnings soon.</p>

            <div class="info-box">
              <div class="symbol">${sampleData.symbol}</div>
              <p><strong>Earnings Date:</strong> ${formattedDate}</p>
              <p><strong>Days Until Earnings:</strong> 3 days</p>
            </div>

            <div style="text-align: center;">
              <a href="${APP_URL}" class="button">
                View Earnings Details
              </a>
            </div>

            <p>Stay informed and never miss important earnings announcements!</p>
          </div>
          <div class="footer">
            <p>TickrTime. Never miss earnings again.</p>
            <p>This email was sent to ${TEST_EMAIL}</p>
            <p style="margin-top: 20px; font-size: 12px; color: #999;">
              <a href="#" style="color: #999;">Unsubscribe from this alert</a> |
              <a href="#" style="color: #999;">Unsubscribe from all emails</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  });

  if (result.error) {
    console.error('Failed to send "before" email:', result.error);
  } else {
    console.log('✓ "Before" email sent successfully! ID:', result.data?.id);
  }
}

async function sendAfterEmail() {
  console.log('\nSending "after" earnings alert email...');

  // Use yesterday's date for the "after" scenario
  const earningsDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
  const formattedDate = earningsDate.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  // Sample earnings results
  const actual = 1.52;
  const estimate = 1.43;
  const surprise = actual - estimate;
  const surprisePercent = (surprise / estimate) * 100;

  const result = await resend.emails.send({
    from: 'TickrTime <onboarding@resend.dev>',
    to: TEST_EMAIL,
    subject: `Earnings Results: ${sampleData.symbol} has reported`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Earnings Results - ${sampleData.symbol}</title>
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
            <h1>TickrTime</h1>
            <p>Earnings Results</p>
          </div>
          <div class="content">
            <h2>Earnings Reported: ${sampleData.symbol}</h2>
            <p>Hi ${sampleData.userName},</p>
            <p><strong>${sampleData.companyName}</strong> (${sampleData.symbol}) has reported earnings.</p>

            <div class="info-box">
              <div class="symbol">${sampleData.symbol}</div>
              <p><strong>Earnings Date:</strong> ${formattedDate}</p>
            </div>

            <table class="results-table">
              <tr><td>Estimate:</td><td>$${estimate.toFixed(2)}</td></tr>
              <tr><td>Actual:</td><td>$${actual.toFixed(2)}</td></tr>
              <tr><td>Surprise:</td><td class="${surprise >= 0 ? 'positive' : 'negative'}">+$${surprise.toFixed(2)}</td></tr>
              <tr><td>Surprise %:</td><td class="${surprisePercent >= 0 ? 'positive' : 'negative'}">+${surprisePercent.toFixed(2)}%</td></tr>
            </table>

            <div style="text-align: center;">
              <a href="${APP_URL}" class="button">
                View Full Details
              </a>
            </div>
          </div>
          <div class="footer">
            <p>TickrTime. Never miss earnings again.</p>
            <p>This email was sent to ${TEST_EMAIL}</p>
            <p style="margin-top: 20px; font-size: 12px; color: #999;">
              <a href="#" style="color: #999;">Unsubscribe from this alert</a> |
              <a href="#" style="color: #999;">Unsubscribe from all emails</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  });

  if (result.error) {
    console.error('Failed to send "after" email:', result.error);
  } else {
    console.log('✓ "After" email sent successfully! ID:', result.data?.id);
  }
}

async function main() {
  console.log(`\n📧 Sending test emails to: ${TEST_EMAIL}\n`);
  console.log('─'.repeat(50));

  await sendBeforeEmail();
  await sendAfterEmail();

  console.log('\n─'.repeat(50));
  console.log('✅ Done! Check your inbox.\n');
}

main().catch(console.error);
