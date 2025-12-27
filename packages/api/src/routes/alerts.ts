import { Hono } from 'hono';
import type { Env } from '../index';
import { createLogger } from '../lib/logger';
import { verifyToken } from '../lib/auth';
import { createDB } from '../lib/db';
import { getUserById, getUserByEmail, updateUser } from '../lib/db/users';
import { createAlert, getUserAlerts, getAlertByUserAndId, updateAlert, deleteAlert } from '../lib/db/alerts';
import { generateUUID } from '../lib/crypto';
import { sendEarningsAlertEmail } from '../lib/email';
import type { NotificationPreferences } from '../lib/db/users';

const app = new Hono<{ Bindings: Env }>();
const logger = createLogger('alerts');

// Helper function to get user from token
async function getUserFromToken(c: any): Promise<{ userId: string; email: string; emailVerified: boolean } | null> {
  const authHeader = c.req.header('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  return await verifyToken(token, c.env!.JWT_SECRET);
}

// GET /api/alerts - Get all alerts for authenticated user
app.get('/', async (c) => {
  try {
    const user = await getUserFromToken(c);
    if (!user) {
      return c.json({ success: false, message: 'Unauthorized' }, 401);
    }

    const db = createDB(c.env!);
    const alerts = await getUserAlerts(db, user.userId);

    return c.json({
      success: true,
      alerts,
    });
  } catch (error) {
    logger.error('Get alerts error:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
});

// POST /api/alerts - Create new alert
app.post('/', async (c) => {
  try {
    const user = await getUserFromToken(c);
    if (!user) {
      return c.json({ success: false, message: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { symbol, alertType, daysBefore, daysAfter, recurring, earningsDate } = body;

    // Validation
    if (!symbol || !alertType || !earningsDate) {
      return c.json(
        { success: false, message: 'Missing required fields: symbol, alertType, earningsDate' },
        400
      );
    }

    if (alertType === 'before' && (!daysBefore || daysBefore < 0)) {
      return c.json(
        { success: false, message: 'daysBefore is required for before alerts' },
        400
      );
    }

    if (alertType === 'after' && (daysAfter === undefined || daysAfter < 0)) {
      return c.json(
        { success: false, message: 'daysAfter is required for after alerts' },
        400
      );
    }

    const db = createDB(c.env!);
    let kvUser = await getUserById(db, user.userId);

    // Fallback: if user not found by ID, try by email
    if (!kvUser) {
      kvUser = await getUserByEmail(db, user.email);
      if (!kvUser) {
        return c.json(
          {
            success: false,
            message: 'User not found in database. Please sign up again or contact support.'
          },
          404
        );
      }
    }

    const actualUserId = kvUser.id;

    // Create alert object
    const now = new Date().toISOString();
    const alert = {
      id: generateUUID(),
      userId: actualUserId,
      symbol: symbol.toUpperCase(),
      alertType,
      daysBefore: alertType === 'before' ? daysBefore : undefined,
      daysAfter: alertType === 'after' ? daysAfter : undefined,
      recurring: recurring === true,
      earningsDate,
      status: 'active' as const,
      createdAt: now,
      updatedAt: now,
      scheduledEmailId: undefined as string | undefined,
    };

    // If "before" alert, schedule email via Resend
    if (alertType === 'before') {
      const earningsDateObj = new Date(earningsDate);
      const scheduledDate = new Date(earningsDateObj);
      scheduledDate.setDate(scheduledDate.getDate() - daysBefore);

      // Only schedule if the date is in the future
      if (scheduledDate > new Date()) {
        const emailResult = await sendEarningsAlertEmail(
          {
            email: kvUser.email,
            symbol: alert.symbol,
            earningsDate: alert.earningsDate,
            daysUntil: daysBefore,
            alertType: 'before',
            userName: kvUser.email.split('@')[0],
          },
          c.env!.RESEND_API_KEY,
          c.env!.NEXT_PUBLIC_APP_URL,
          scheduledDate.toISOString()
        );

        if (emailResult.success && emailResult.emailId) {
          alert.scheduledEmailId = emailResult.emailId;
        } else {
          logger.warn('Failed to schedule email for alert:', emailResult.error);
        }
      }
    }

    // Save alert to D1
    const success = await createAlert(db, {
      id: alert.id,
      userId: actualUserId,
      symbol: alert.symbol,
      alertType: alert.alertType,
      daysBefore: alert.daysBefore,
      daysAfter: alert.daysAfter,
      recurring: alert.recurring,
      earningsDate: alert.earningsDate,
      scheduledEmailId: alert.scheduledEmailId,
      status: alert.status,
    });
    
    if (!success) {
      return c.json({ success: false, message: 'Failed to create alert' }, 500);
    }

    return c.json({
      success: true,
      message: 'Alert created successfully',
      alert,
    });
  } catch (error) {
    logger.error('Create alert error:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
});

// GET /api/alerts/:id - Get specific alert
app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const user = await getUserFromToken(c);
    if (!user) {
      return c.json({ success: false, message: 'Unauthorized' }, 401);
    }

    const db = createDB(c.env!);
    const alert = await getAlertByUserAndId(db, user.userId, id);

    if (!alert) {
      return c.json({ success: false, message: 'Alert not found' }, 404);
    }

    return c.json({
      success: true,
      alert,
    });
  } catch (error) {
    logger.error('Get alert error:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
});

// PUT /api/alerts/:id - Update alert
app.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const user = await getUserFromToken(c);
    if (!user) {
      return c.json({ success: false, message: 'Unauthorized' }, 401);
    }

    const db = createDB(c.env!);
    const alert = await getAlertByUserAndId(db, user.userId, id);

    if (!alert) {
      return c.json({ success: false, message: 'Alert not found' }, 404);
    }

    const body = await c.req.json();
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
      const kvUser = await getUserById(db, user.userId);
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
            c.env!.RESEND_API_KEY,
            c.env!.NEXT_PUBLIC_APP_URL,
            scheduledDate.toISOString()
          );

          if (emailResult.success && emailResult.emailId) {
            updates.scheduledEmailId = emailResult.emailId;
          }
        }
      }
    }

    const success = await updateAlert(db, id, updates);
    if (!success) {
      return c.json({ success: false, message: 'Failed to update alert' }, 500);
    }

    const updatedAlert = await getAlertByUserAndId(db, user.userId, id);
    return c.json({
      success: true,
      message: 'Alert updated successfully',
      alert: updatedAlert,
    });
  } catch (error) {
    logger.error('Update alert error:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
});

// DELETE /api/alerts/:id - Delete alert
app.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const user = await getUserFromToken(c);
    if (!user) {
      return c.json({ success: false, message: 'Unauthorized' }, 401);
    }

    const db = createDB(c.env!);
    const alert = await getAlertByUserAndId(db, user.userId, id);

    if (!alert) {
      return c.json({ success: false, message: 'Alert not found' }, 404);
    }

    const success = await deleteAlert(db, id);
    if (!success) {
      return c.json({ success: false, message: 'Failed to delete alert' }, 500);
    }

    return c.json({
      success: true,
      message: 'Alert deleted successfully',
    });
  } catch (error) {
    logger.error('Delete alert error:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
});

// GET /api/alerts/preferences - Get user's notification preferences
app.get('/preferences', async (c) => {
  try {
    const user = await getUserFromToken(c);
    if (!user) {
      return c.json({ success: false, message: 'Unauthorized' }, 401);
    }

    const db = createDB(c.env!);
    let kvUser = await getUserById(db, user.userId);
    
    // Fallback: if user not found by ID, try by email
    if (!kvUser) {
      kvUser = await getUserByEmail(db, user.email);
      if (!kvUser) {
        return c.json(
          { success: false, message: 'User not found. Please log out and log back in.' },
          404
        );
      }
    }

    // Return preferences or defaults
    const preferences: NotificationPreferences = kvUser.notificationPreferences || {
      emailEnabled: true,
      defaultDaysBefore: 1,
      defaultDaysAfter: 0,
    };

    return c.json({
      success: true,
      preferences,
    });
  } catch (error) {
    logger.error('Get notification preferences error:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
});

// PUT /api/alerts/preferences - Update user's notification preferences
app.put('/preferences', async (c) => {
  try {
    const user = await getUserFromToken(c);
    if (!user) {
      return c.json({ success: false, message: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { emailEnabled, defaultDaysBefore, defaultDaysAfter } = body;

    // Validation
    if (emailEnabled !== undefined && typeof emailEnabled !== 'boolean') {
      return c.json(
        { success: false, message: 'emailEnabled must be a boolean' },
        400
      );
    }

    if (defaultDaysBefore !== undefined && (typeof defaultDaysBefore !== 'number' || defaultDaysBefore < 0)) {
      return c.json(
        { success: false, message: 'defaultDaysBefore must be a non-negative number' },
        400
      );
    }

    if (defaultDaysAfter !== undefined && (typeof defaultDaysAfter !== 'number' || defaultDaysAfter < 0)) {
      return c.json(
        { success: false, message: 'defaultDaysAfter must be a non-negative number' },
        400
      );
    }

    const db = createDB(c.env!);
    let kvUser = await getUserById(db, user.userId);

    // Fallback: if user not found by ID, try by email
    if (!kvUser) {
      kvUser = await getUserByEmail(db, user.email);
      if (!kvUser) {
        return c.json(
          { success: false, message: 'User not found. Please log out and log back in.' },
          404
        );
      }
    }

    // Update preferences
    const currentPreferences = kvUser.notificationPreferences || {
      emailEnabled: true,
      defaultDaysBefore: 1,
      defaultDaysAfter: 0,
    };

    const updatedPreferences: NotificationPreferences = {
      emailEnabled: emailEnabled !== undefined ? emailEnabled : currentPreferences.emailEnabled,
      defaultDaysBefore: defaultDaysBefore !== undefined ? defaultDaysBefore : currentPreferences.defaultDaysBefore,
      defaultDaysAfter: defaultDaysAfter !== undefined ? defaultDaysAfter : currentPreferences.defaultDaysAfter,
    };

    const success = await updateUser(db, kvUser.id, {
      notificationPreferences: updatedPreferences,
    });

    if (!success) {
      return c.json({ success: false, message: 'Failed to update preferences' }, 500);
    }

    return c.json({
      success: true,
      message: 'Preferences updated successfully',
      preferences: updatedPreferences,
    });
  } catch (error) {
    logger.error('Update notification preferences error:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
});

export default app;





