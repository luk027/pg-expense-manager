import { createMiddleware } from 'hono/factory';
import { verifySessionToken, AuthUser } from '../routes/auth';

export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized: missing or invalid authorization token' }, 401);
  }

  const token = authHeader.substring(7);
  const user = verifySessionToken(token);

  if (!user) {
    return c.json({ error: 'Unauthorized: session expired or invalid' }, 401);
  }

  c.set('user', user);
  await next();
});

export function getAuthUser(c: any): AuthUser | undefined {
  return c.get('user');
}
