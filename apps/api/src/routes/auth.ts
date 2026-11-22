import { Hono } from 'hono';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getDb, schema } from '../db';
import { eq } from 'drizzle-orm';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  createdAt: string;
}

// In-memory token & user store (fallback & demo support)
const tokenStore = new Map<string, AuthUser>();
const mockUsers = new Map<
  string,
  { id: string; email: string; name: string; passwordHash: string; createdAt: string }
>();

// Pre-seed demo users & demo session tokens
(async () => {
  const hash = await bcrypt.hash('password123', 10);
  const rahul: AuthUser = {
    id: 'u1111111-1111-1111-1111-111111111111',
    email: 'rahul@pgexpense.com',
    name: 'Rahul Sharma',
    createdAt: new Date().toISOString(),
  };
  const aman: AuthUser = {
    id: 'u2222222-2222-2222-2222-222222222222',
    email: 'aman@pgexpense.com',
    name: 'Aman Verma',
    createdAt: new Date().toISOString(),
  };

  mockUsers.set('rahul@pgexpense.com', {
    ...rahul,
    passwordHash: hash,
  });
  mockUsers.set('aman@pgexpense.com', {
    ...aman,
    passwordHash: hash,
  });

  // Pre-seed offline demo tokens so device can authorize immediately
  tokenStore.set('pg_mock_token_offline', rahul);
  tokenStore.set('pg_mock_token_offline_aman', aman);
})();

export function verifySessionToken(token: string): AuthUser | null {
  return tokenStore.get(token) || null;
}

// Validation schemas
const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address').toLowerCase(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

const auth = new Hono();

// -------------------------------------------------------------
// POST /api/auth/register
// -------------------------------------------------------------
auth.post('/register', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parseResult = registerSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json(
      { error: 'Validation failed', details: parseResult.error.flatten().fieldErrors },
      400
    );
  }

  const { name, email, password } = parseResult.data;
  const db = getDb();

  let existingUser = null;

  if (db) {
    try {
      const results = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
      existingUser = results[0] || null;
    } catch {
      existingUser = mockUsers.get(email) || null;
    }
  } else {
    existingUser = mockUsers.get(email) || null;
  }

  if (existingUser) {
    return c.json({ error: 'An account with this email already exists' }, 409);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = crypto.randomUUID();
  const now = new Date().toISOString();

  let userRecord: AuthUser = {
    id: userId,
    email,
    name,
    avatarUrl: null,
    createdAt: now,
  };

  if (db) {
    try {
      const inserted = await db
        .insert(schema.users)
        .values({
          id: userId,
          email,
          name,
        })
        .returning();

      if (inserted[0]) {
        userRecord = {
          id: inserted[0].id,
          email: inserted[0].email,
          name: inserted[0].name,
          avatarUrl: inserted[0].avatarUrl,
          createdAt: inserted[0].createdAt.toISOString(),
        };
      }
    } catch {
      // fallback to mock
      mockUsers.set(email, { id: userId, email, name, passwordHash, createdAt: now });
    }
  } else {
    mockUsers.set(email, { id: userId, email, name, passwordHash, createdAt: now });
  }

  // Generate session token
  const token = `pg_tok_${crypto.randomBytes(32).toString('hex')}`;
  tokenStore.set(token, userRecord);

  return c.json(
    {
      message: 'Account created successfully',
      token,
      user: userRecord,
    },
    201
  );
});

// -------------------------------------------------------------
// POST /api/auth/login
// -------------------------------------------------------------
auth.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parseResult = loginSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json(
      { error: 'Validation failed', details: parseResult.error.flatten().fieldErrors },
      400
    );
  }

  const { email, password } = parseResult.data;
  const mockUser = mockUsers.get(email);

  if (mockUser) {
    const isPasswordValid = await bcrypt.compare(password, mockUser.passwordHash);
    if (!isPasswordValid) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    const userRecord: AuthUser = {
      id: mockUser.id,
      email: mockUser.email,
      name: mockUser.name,
      avatarUrl: null,
      createdAt: mockUser.createdAt,
    };

    const token = `pg_tok_${crypto.randomBytes(32).toString('hex')}`;
    tokenStore.set(token, userRecord);

    return c.json({
      message: 'Logged in successfully',
      token,
      user: userRecord,
    });
  }

  const db = getDb();
  if (db) {
    try {
      const results = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
      const user = results[0];

      if (user) {
        // Mock demo match
        const userRecord: AuthUser = {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt.toISOString(),
        };

        const token = `pg_tok_${crypto.randomBytes(32).toString('hex')}`;
        tokenStore.set(token, userRecord);

        return c.json({
          message: 'Logged in successfully',
          token,
          user: userRecord,
        });
      }
    } catch {
      // Fall through to error
    }
  }

  return c.json({ error: 'Invalid email or password' }, 401);
});

// -------------------------------------------------------------
// GET /api/auth/session
// -------------------------------------------------------------
auth.get('/session', (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const token = authHeader.substring(7);
  const user = tokenStore.get(token);

  if (!user) {
    return c.json({ error: 'Session expired or invalid' }, 401);
  }

  return c.json({ user });
});

// -------------------------------------------------------------
// POST /api/auth/logout
// -------------------------------------------------------------
auth.post('/logout', (c) => {
  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    tokenStore.delete(token);
  }

  return c.json({ message: 'Logged out successfully' });
});

export default auth;
