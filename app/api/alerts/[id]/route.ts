import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

import { verifyToken } from '@/lib/auth';
import { getUserById } from '@/lib/db/users';
import { getAlertByUserAndId, updateAlert, deleteAlert } from '@/lib/db/alerts';
import { sendEarningsAlertEmail } from '@/lib/email';
import type { KVAlert } from '@/lib/auth';

export const runtime = 'edge';

// Helper function to get user from token
async function getUserFromToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  return await verifyToken(token);
}

// GET - Get specific alert
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const alert = await getAlertByUserAndId(user.userId, id);

    if (!alert) {
      return NextResponse.json(
        { success: false, message: 'Alert not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      alert,
    });
  } catch (error) {
    logger.error('Get alert error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update alert
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const alert = await getAlertByUserAndId(user.userId, id);

    if (!alert) {
      return NextResponse.json(
        { success: false, message: 'Alert not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const updates: Partial<{
      daysBefore: number;
      daysAfter: number;
      recurring: boolean;
      earningsDate: string;
      status: 'active' | 'sent' | 'cancelled';
      scheduledEmailId: string;
    }> = {};

    // Allow updating: daysBefore, daysAfter, recurring, earningsDate, status
    if (body.daysBefore !== undefined) updates.daysBefore = body.daysBefore;
    if (body.daysAfter !== undefined) updates.daysAfter = body.daysAfter;
    if (body.recurring !== undefined) updates.recurring = body.recurring;
    if (body.earningsDate !== undefined) updates.earningsDate = body.earningsDate;
    if (body.status !== undefined) updates.status = body.status;

    // If updating a "before" alert with new earningsDate or daysBefore, reschedule email
    if (alert.alertType === 'before' && (updates.earningsDate || updates.daysBefore)) {
      const kvUser = await getUserById(user.userId);
      if (kvUser) {
        const finalEarningsDate = updates.earningsDate || alert.earningsDate;
        const finalDaysBefore = updates.daysBefore !== undefined ? updates.daysBefore : alert.daysBefore || 1;
        
        const earningsDateObj = new Date(finalEarningsDate);
        const scheduledDate = new Date(earningsDateObj);
        scheduledDate.setDate(scheduledDate.getDate() - finalDaysBefore);
        
        if (scheduledDate > new Date()) {
          const emailResult = await sendEarningsAlertEmail(
            {
              email: kvUser.email,
              symbol: alert.symbol,
              earningsDate: finalEarningsDate,
              daysUntil: finalDaysBefore,
              alertType: 'before',
              userName: kvUser.email.split('@')[0],
            },
            scheduledDate.toISOString()
          );

          if (emailResult.success && emailResult.emailId) {
            updates.scheduledEmailId = emailResult.emailId;
          }
        }
      }
    }

    const success = await updateAlert(id, updates);
    if (!success) {
      return NextResponse.json(
        { success: false, message: 'Failed to update alert' },
        { status: 500 }
      );
    }

    const updatedAlert = await getAlertByUserAndId(user.userId, id);
    return NextResponse.json({
      success: true,
      message: 'Alert updated successfully',
      alert: updatedAlert,
    });
  } catch (error) {
    logger.error('Update alert error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete alert
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const alert = await getAlertByUserAndId(user.userId, id);

    if (!alert) {
      return NextResponse.json(
        { success: false, message: 'Alert not found' },
        { status: 404 }
      );
    }

    // Note: We can't cancel scheduled Resend emails via API easily
    // The email will still be sent, but the alert will be deleted
    // In production, you might want to store email IDs and cancel them

    const success = await deleteAlert(id);
    if (!success) {
      return NextResponse.json(
        { success: false, message: 'Failed to delete alert' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Alert deleted successfully',
    });
  } catch (error) {
    logger.error('Delete alert error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

