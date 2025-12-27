import type { Context } from 'hono';
import { verifyToken } from '../lib/auth';
import type { Env } from '../index';

export async function requireAuth(c: Context<{ Bindings: Env }>) {
  const authHeader = c.req.header('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);
  const userData = await verifyToken(token, c.env.JWT_SECRET);
  
  if (!userData) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  return userData;
}





