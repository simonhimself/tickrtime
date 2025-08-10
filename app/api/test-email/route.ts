import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { testEmailService } from '@/lib/email';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({
        success: false,
        message: 'Email is required'
      }, { status: 400 });
    }

    const sent = await testEmailService(email);

    if (sent) {
      return NextResponse.json({
        success: true,
        message: 'Test email sent successfully'
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Failed to send test email. Check RESEND_API_KEY configuration.'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Test email error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}
