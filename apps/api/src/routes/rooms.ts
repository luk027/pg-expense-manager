import { Hono } from 'hono';
import { z } from 'zod';
import crypto from 'crypto';
import { authMiddleware } from '../middleware/auth';
import { AuthUser } from './auth';
import { DEFAULT_CATEGORIES } from '../db/seed';

export interface RoomDetails {
  id: string;
  name: string;
  adminId: string;
  collectorId: string;
  monthlyRentPaise: number;
  settlementDay: number;
  notificationsEnabled: boolean;
  status: 'active' | 'closed';
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemberRecord {
  id: string;
  roomId: string;
  userId: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
  status: 'pending' | 'active' | 'departed';
  joinedAt?: string | null;
  departedAt?: string | null;
  createdAt: string;
}

export interface CategoryRecord {
  id: string;
  roomId: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface InviteRecord {
  id: string;
  roomId: string;
  token: string;
  createdByUserId: string;
  status: 'pending' | 'used' | 'expired';
  expiresAt: string;
  createdAt: string;
}

export interface RentHistoryRecord {
  id: string;
  roomId: string;
  previousRentPaise: number;
  newRentPaise: number;
  effectiveFrom: string; // YYYY-MM-DD or YYYY-MM
  reason?: string;
  changedByUserId: string;
  changedByName: string;
  createdAt: string;
}

// In-memory persistent state (supported offline & with DB fallback)
export const roomsStore = new Map<string, RoomDetails>();
export const membersStore = new Map<string, MemberRecord>();
export const categoriesStore = new Map<string, CategoryRecord[]>();
export const invitesStore = new Map<string, InviteRecord>();
export const roomActivityLog = new Map<string, any[]>();
export const rentHistoryStore = new Map<string, RentHistoryRecord[]>();

// Pre-seed Demo Room for Rahul & Aman
const DEMO_ROOM_ID = 'r3023023-3023-3023-3023-302330233023';

(() => {
  const now = new Date().toISOString();
  roomsStore.set(DEMO_ROOM_ID, {
    id: DEMO_ROOM_ID,
    name: 'Flat 302, Green Glen',
    adminId: 'u1111111-1111-1111-1111-111111111111', // Rahul
    collectorId: 'u1111111-1111-1111-1111-111111111111', // Rahul
    monthlyRentPaise: 2800000, // ₹28,000
    settlementDay: 28,
    notificationsEnabled: true,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });

  // Members
  const m1 = 'm1111111-1111-1111-1111-111111111111';
  membersStore.set(m1, {
    id: m1,
    roomId: DEMO_ROOM_ID,
    userId: 'u1111111-1111-1111-1111-111111111111',
    name: 'Rahul Sharma',
    email: 'rahul@pgexpense.com',
    role: 'admin',
    status: 'active',
    joinedAt: now,
    createdAt: now,
  });

  const m2 = 'm2222222-2222-2222-2222-222222222222';
  membersStore.set(m2, {
    id: m2,
    roomId: DEMO_ROOM_ID,
    userId: 'u2222222-2222-2222-2222-222222222222',
    name: 'Aman Verma',
    email: 'aman@pgexpense.com',
    role: 'member',
    status: 'active',
    joinedAt: now,
    createdAt: now,
  });

  // Other room members
  const m3 = 'm3333333-3333-3333-3333-333333333333';
  membersStore.set(m3, {
    id: m3,
    roomId: DEMO_ROOM_ID,
    userId: 'u3333333-3333-3333-3333-333333333333',
    name: 'Kunal Patel',
    email: 'kunal@pgexpense.com',
    role: 'member',
    status: 'active',
    joinedAt: now,
    createdAt: now,
  });

  const m4 = 'm4444444-4444-4444-4444-444444444444';
  membersStore.set(m4, {
    id: m4,
    roomId: DEMO_ROOM_ID,
    userId: 'u4444444-4444-4444-4444-444444444444',
    name: 'Sameer Rao',
    email: 'sameer@pgexpense.com',
    role: 'member',
    status: 'active',
    joinedAt: now,
    createdAt: now,
  });

  // Categories
  const cats = DEFAULT_CATEGORIES.map((cName) => ({
    id: crypto.randomUUID(),
    roomId: DEMO_ROOM_ID,
    name: cName,
    isDefault: true,
    isActive: true,
    createdAt: now,
  }));
  categoriesStore.set(DEMO_ROOM_ID, cats);

  // Pre-seed rent history
  rentHistoryStore.set(DEMO_ROOM_ID, [
    {
      id: 'rh-1',
      roomId: DEMO_ROOM_ID,
      previousRentPaise: 2600000,
      newRentPaise: 2800000,
      effectiveFrom: '2026-10-01',
      reason: 'Annual lease renewal (7.7% increase)',
      changedByUserId: 'u1111111-1111-1111-1111-111111111111',
      changedByName: 'Rahul Sharma',
      createdAt: '2026-10-01T10:00:00.000Z',
    },
  ]);
})();

export function logActivity(roomId: string, userId: string, action: string, details: any) {
  const currentLogs = roomActivityLog.get(roomId) || [];
  currentLogs.unshift({
    id: crypto.randomUUID(),
    roomId,
    userId,
    action,
    details,
    createdAt: new Date().toISOString(),
  });
  roomActivityLog.set(roomId, currentLogs);
}

// -------------------------------------------------------------
// VALIDATION SCHEMAS
// -------------------------------------------------------------
const createRoomSchema = z.object({
  name: z.string().min(2, 'Room name must be at least 2 characters').max(100),
  monthlyRentPaise: z.number().int().positive('Monthly rent must be a positive amount in paise'),
  settlementDay: z.number().int().min(1).max(28).default(28),
});

const updateRoomSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  monthlyRentPaise: z.number().int().positive().optional(),
  settlementDay: z.number().int().min(1).max(28).optional(),
  notificationsEnabled: z.boolean().optional(),
});

const joinSchema = z.object({
  token: z.string().min(10, 'Invalid invitation token'),
});

const transferAdminSchema = z.object({
  newAdminUserId: z.string().min(1, 'New admin user ID required'),
});

const assignCollectorSchema = z.object({
  collectorUserId: z.string().min(1, 'Collector user ID required'),
});

const changeRentSchema = z.object({
  newRentPaise: z.number().int().positive('New rent must be a positive integer in paise'),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/, 'Effective date must be YYYY-MM-DD or YYYY-MM'),
  reason: z.string().max(200).optional(),
});

// -------------------------------------------------------------
// HONO ROUTER
// -------------------------------------------------------------
const rooms = new Hono<{ Variables: { user: AuthUser } }>();

// All room routes require authentication
rooms.use('*', authMiddleware);

// -------------------------------------------------------------
// GET /api/rooms/current
// Get the current user's room with full details
// -------------------------------------------------------------
rooms.get('/current', (c) => {
  const user = c.get('user');

  // Find user's active or pending room membership
  const userMembership = Array.from(membersStore.values()).find(
    (m) => m.userId === user.id && m.status !== 'departed'
  );

  if (!userMembership) {
    return c.json({ hasRoom: false, message: 'User does not belong to any active room' }, 200);
  }

  const room = roomsStore.get(userMembership.roomId);
  if (!room) {
    return c.json({ hasRoom: false, message: 'Room not found' }, 404);
  }

  // Get all room members
  const allMembers = Array.from(membersStore.values()).filter(
    (m) => m.roomId === room.id
  );

  const activeMembers = allMembers.filter((m) => m.status === 'active');
  const pendingMembers = allMembers.filter((m) => m.status === 'pending');
  const categories = categoriesStore.get(room.id) || [];

  return c.json({
    hasRoom: true,
    room,
    membership: userMembership,
    activeMembers,
    pendingMembers,
    categories,
    isAdmin: room.adminId === user.id,
    isCollector: room.collectorId === user.id,
  });
});

// -------------------------------------------------------------
// POST /api/rooms
// Create a new room
// -------------------------------------------------------------
rooms.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => null);
  const parseResult = createRoomSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json(
      { error: 'Validation failed', details: parseResult.error.flatten().fieldErrors },
      400
    );
  }

  // Check if user already belongs to an active room
  const existingMembership = Array.from(membersStore.values()).find(
    (m) => m.userId === user.id && m.status === 'active'
  );
  if (existingMembership) {
    return c.json(
      { error: 'You are already an active member of a room. A user can belong to only one room at a time.' },
      409
    );
  }

  const { name, monthlyRentPaise, settlementDay } = parseResult.data;
  const roomId = crypto.randomUUID();
  const now = new Date().toISOString();

  const newRoom: RoomDetails = {
    id: roomId,
    name,
    adminId: user.id,
    collectorId: user.id,
    monthlyRentPaise,
    settlementDay,
    notificationsEnabled: true,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  roomsStore.set(roomId, newRoom);

  // Add creator as Admin member
  const memberId = crypto.randomUUID();
  const creatorMember: MemberRecord = {
    id: memberId,
    roomId,
    userId: user.id,
    name: user.name,
    email: user.email,
    role: 'admin',
    status: 'active',
    joinedAt: now,
    createdAt: now,
  };
  membersStore.set(memberId, creatorMember);

  // Seed default categories
  const seededCategories: CategoryRecord[] = DEFAULT_CATEGORIES.map((catName) => ({
    id: crypto.randomUUID(),
    roomId,
    name: catName,
    isDefault: true,
    isActive: true,
    createdAt: now,
  }));
  categoriesStore.set(roomId, seededCategories);

  logActivity(roomId, user.id, 'room_created', { name, monthlyRentPaise });

  return c.json(
    {
      message: 'Room created successfully',
      room: newRoom,
      membership: creatorMember,
      categories: seededCategories,
    },
    201
  );
});

// -------------------------------------------------------------
// PATCH /api/rooms/:roomId
// Update room settings (Admin only)
// -------------------------------------------------------------
rooms.patch('/:roomId', async (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');
  const room = roomsStore.get(roomId);

  if (!room) {
    return c.json({ error: 'Room not found' }, 404);
  }

  if (room.status === 'closed') {
    return c.json({ error: 'Room is closed and archived' }, 403);
  }

  if (room.adminId !== user.id) {
    return c.json({ error: 'Forbidden: only the room admin can update room settings' }, 403);
  }

  const body = await c.req.json().catch(() => null);
  const parseResult = updateRoomSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten().fieldErrors }, 400);
  }

  const updates = parseResult.data;
  const updatedRoom: RoomDetails = {
    ...room,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  roomsStore.set(roomId, updatedRoom);
  logActivity(roomId, user.id, 'room_updated', updates);

  return c.json({ message: 'Room updated successfully', room: updatedRoom });
});

// -------------------------------------------------------------
// GET /api/rooms/:roomId/rent/history
// List historical rent changes and current monthly rent
// -------------------------------------------------------------
rooms.get('/:roomId/rent/history', (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');
  const room = roomsStore.get(roomId);

  if (!room) {
    return c.json({ error: 'Room not found' }, 404);
  }

  const history = rentHistoryStore.get(roomId) || [];
  return c.json({
    success: true,
    currentRentPaise: room.monthlyRentPaise,
    history,
  });
});

// -------------------------------------------------------------
// POST /api/rooms/:roomId/rent
// Change monthly rent with an effective date (Admin only)
// -------------------------------------------------------------
rooms.post('/:roomId/rent', async (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');
  const room = roomsStore.get(roomId);

  if (!room) {
    return c.json({ error: 'Room not found' }, 404);
  }

  if (room.status === 'closed') {
    return c.json({ error: 'Room is closed and archived' }, 403);
  }

  if (room.adminId !== user.id) {
    return c.json({ error: 'Forbidden: only the room admin can modify room rent' }, 403);
  }

  const body = await c.req.json().catch(() => null);
  const parseResult = changeRentSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten().fieldErrors }, 400);
  }

  const { newRentPaise, effectiveFrom, reason } = parseResult.data;
  const previousRentPaise = room.monthlyRentPaise;

  const members = Array.from(membersStore.values()).filter((m) => m.roomId === roomId);
  const adminMember = members.find((m) => m.userId === user.id);

  const rentRecord: RentHistoryRecord = {
    id: `rh-${crypto.randomUUID()}`,
    roomId,
    previousRentPaise,
    newRentPaise,
    effectiveFrom,
    reason: reason || undefined,
    changedByUserId: user.id,
    changedByName: adminMember?.name || user.name || 'Admin',
    createdAt: new Date().toISOString(),
  };

  const existingHistory = rentHistoryStore.get(roomId) || [];
  existingHistory.unshift(rentRecord);
  rentHistoryStore.set(roomId, existingHistory);

  const updatedRoom: RoomDetails = {
    ...room,
    monthlyRentPaise: newRentPaise,
    updatedAt: new Date().toISOString(),
  };
  roomsStore.set(roomId, updatedRoom);

  logActivity(roomId, user.id, 'rent_changed', {
    previousRentPaise,
    newRentPaise,
    effectiveFrom,
    reason,
  });

  return c.json(
    {
      success: true,
      message: `Room rent updated to ₹${Math.round(newRentPaise / 100).toLocaleString('en-IN')}`,
      room: updatedRoom,
      rentRecord,
    },
    201
  );
});

// -------------------------------------------------------------
// GET /api/rooms/:roomId/close-check
// Check if room has unsettled balances before closing
// -------------------------------------------------------------
rooms.get('/:roomId/close-check', async (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');
  const room = roomsStore.get(roomId);

  if (!room) {
    return c.json({ error: 'Room not found' }, 404);
  }

  let unfinalizedExpensesCount = 0;
  let unpaidPaise = 0;
  let unpaidCount = 0;
  const unpaidMembers: string[] = [];

  try {
    const { expensesStore } = (await import('./expenses.js')) as any;
    const { settlementsStore, settlementSharesStore } = (await import('./settlements.js')) as any;

    // Count unfinalized expenses in current period
    const roomExpenses = Array.from((expensesStore as Map<string, any>).values()).filter(
      (e: any) => e.roomId === roomId && !e.deletedAt && !e.settlementId
    );
    unfinalizedExpensesCount = roomExpenses.length;

    // Check unpaid shares in settlements
    const settlements = Array.from((settlementsStore as Map<string, any>).values()).filter(
      (s: any) => s.roomId === roomId
    );
    for (const s of settlements) {
      const shares = (settlementSharesStore as Map<string, any[]>).get(s.id) || [];
      for (const share of shares) {
        const remaining = share.amountOwedPaise - share.amountPaidPaise;
        if (remaining > 0) {
          unpaidPaise += remaining;
          unpaidCount++;
          if (!unpaidMembers.includes(share.userName)) {
            unpaidMembers.push(share.userName);
          }
        }
      }
    }
  } catch (err) {
    // safe fallback
  }

  const hasUnsettledBalances = unpaidPaise > 0 || unfinalizedExpensesCount > 0;

  return c.json({
    success: true,
    canClose: true,
    hasUnsettledBalances,
    unpaidPaise,
    unpaidCount,
    unpaidMembers,
    unfinalizedExpensesCount,
    warning: hasUnsettledBalances
      ? `Room has ${unpaidCount} unpaid settlement balance(s) totaling ₹${Math.round(unpaidPaise / 100).toLocaleString('en-IN')} and ${unfinalizedExpensesCount} unfinalized expense(s).`
      : 'All balances are settled. The room can be safely closed.',
  });
});

// -------------------------------------------------------------
// POST /api/rooms/:roomId/close
// Close room and archive (Admin only, checks for unsettled balances unless force=true)
// -------------------------------------------------------------
rooms.post('/:roomId/close', async (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');
  const room = roomsStore.get(roomId);

  if (!room) {
    return c.json({ error: 'Room not found' }, 404);
  }

  if (room.status === 'closed') {
    return c.json({ error: 'Room is closed and archived' }, 403);
  }

  if (room.adminId !== user.id) {
    return c.json({ error: 'Forbidden: only the room admin can close the room' }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const force = body?.force === true;

  if (!force) {
    // Perform check for unsettled balances
    let hasUnsettled = false;
    let balanceMsg = '';
    try {
      const { expensesStore } = (await import('./expenses.js')) as any;
      const roomExpenses = Array.from((expensesStore as Map<string, any>).values()).filter(
        (e: any) => e.roomId === roomId && !e.deletedAt && !e.settlementId
      );
      if (roomExpenses.length > 0) {
        hasUnsettled = true;
        balanceMsg = `${roomExpenses.length} unfinalized expense(s) exist.`;
      }
    } catch {}

    if (hasUnsettled) {
      return c.json(
        {
          error: 'Unsettled balances detected. Please finalize settlements and confirm payments, or pass force: true to close anyway.',
          details: balanceMsg,
          requiresForce: true,
        },
        409
      );
    }
  }

  const now = new Date().toISOString();
  const closedRoom: RoomDetails = {
    ...room,
    status: 'closed',
    closedAt: now,
    updatedAt: now,
  };

  roomsStore.set(roomId, closedRoom);
  logActivity(roomId, user.id, 'room_closed', { forced: force });

  return c.json({ success: true, message: 'Room has been closed and archived', room: closedRoom });
});

// -------------------------------------------------------------
// POST /api/rooms/:roomId/reopen
// Reopen archived room (Admin only)
// -------------------------------------------------------------
rooms.post('/:roomId/reopen', (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');
  const room = roomsStore.get(roomId);

  if (!room) {
    return c.json({ error: 'Room not found' }, 404);
  }

  if (room.adminId !== user.id) {
    return c.json({ error: 'Forbidden: only the room admin can reopen the room' }, 403);
  }

  const now = new Date().toISOString();
  const reopenedRoom: RoomDetails = {
    ...room,
    status: 'active',
    closedAt: undefined,
    updatedAt: now,
  };

  roomsStore.set(roomId, reopenedRoom);
  logActivity(roomId, user.id, 'room_reopened', {});

  return c.json({ success: true, message: 'Room has been reopened and restored to active state', room: reopenedRoom });
});

// -------------------------------------------------------------
// POST /api/rooms/:roomId/invite
// Generate a 7-day invitation link/token (Admin only)
// -------------------------------------------------------------
rooms.post('/:roomId/invite', (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');
  const room = roomsStore.get(roomId);

  if (!room) {
    return c.json({ error: 'Room not found' }, 404);
  }

  if (room.status === 'closed') {
    return c.json({ error: 'Room is closed and archived' }, 403);
  }

  if (room.adminId !== user.id) {
    return c.json({ error: 'Forbidden: only the room admin can generate invitation links' }, 403);
  }

  const token = `inv_${crypto.randomBytes(24).toString('hex')}`;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  const invite: InviteRecord = {
    id: crypto.randomUUID(),
    roomId,
    token,
    createdByUserId: user.id,
    status: 'pending',
    expiresAt,
    createdAt: new Date().toISOString(),
  };

  invitesStore.set(token, invite);
  logActivity(roomId, user.id, 'invite_generated', { token: token.slice(0, 10) + '...' });

  return c.json({
    message: 'Invitation link generated',
    token,
    expiresAt,
    inviteUrl: `pgexpense://join?token=${token}`,
  });
});

// -------------------------------------------------------------
// POST /api/rooms/join
// Join room via token (sets status to pending approval)
// -------------------------------------------------------------
rooms.post('/join', async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => null);
  const parseResult = joinSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten().fieldErrors }, 400);
  }

  const { token } = parseResult.data;
  const invite = invitesStore.get(token);

  if (!invite) {
    return c.json({ error: 'Invalid or expired invitation token' }, 404);
  }

  if (invite.status !== 'pending' || new Date(invite.expiresAt) < new Date()) {
    return c.json({ error: 'This invitation token has expired or already been used' }, 410);
  }

  const room = roomsStore.get(invite.roomId);
  if (!room || room.status === 'closed') {
    return c.json({ error: 'This room is no longer active' }, 400);
  }

  // Check if user is already a member
  const existingMembership = Array.from(membersStore.values()).find(
    (m) => m.userId === user.id && m.status !== 'departed'
  );
  if (existingMembership) {
    return c.json({ error: 'You are already in a room or have a pending request' }, 409);
  }

  const now = new Date().toISOString();
  const memberId = crypto.randomUUID();

  const newMember: MemberRecord = {
    id: memberId,
    roomId: invite.roomId,
    userId: user.id,
    name: user.name,
    email: user.email,
    role: 'member',
    status: 'pending',
    createdAt: now,
  };

  membersStore.set(memberId, newMember);
  logActivity(invite.roomId, user.id, 'join_requested', { userName: user.name, email: user.email });

  return c.json(
    {
      message: 'Join request submitted. Waiting for admin approval.',
      roomName: room.name,
      membership: newMember,
    },
    200
  );
});

// -------------------------------------------------------------
// POST /api/rooms/:roomId/members/:memberId/approve
// Approve pending member (Admin only)
// -------------------------------------------------------------
rooms.post('/:roomId/members/:memberId/approve', (c) => {
  const user = c.get('user');
  const { roomId, memberId } = c.req.param();
  const room = roomsStore.get(roomId);

  if (!room || room.adminId !== user.id) {
    return c.json({ error: 'Forbidden: only the room admin can approve members' }, 403);
  }

  const member = membersStore.get(memberId);
  if (!member || member.roomId !== roomId) {
    return c.json({ error: 'Member record not found' }, 404);
  }

  if (member.status !== 'pending') {
    return c.json({ error: `Member status is already '${member.status}'` }, 400);
  }

  const updatedMember: MemberRecord = {
    ...member,
    status: 'active',
    joinedAt: new Date().toISOString(),
  };

  membersStore.set(memberId, updatedMember);
  logActivity(roomId, user.id, 'member_approved', { memberName: member.name });

  return c.json({ message: 'Roommate approved successfully', member: updatedMember });
});

// -------------------------------------------------------------
// POST /api/rooms/:roomId/members/:memberId/remove
// Remove a member (Admin only)
// -------------------------------------------------------------
rooms.post('/:roomId/members/:memberId/remove', (c) => {
  const user = c.get('user');
  const { roomId, memberId } = c.req.param();
  const room = roomsStore.get(roomId);

  if (!room || room.adminId !== user.id) {
    return c.json({ error: 'Forbidden: only the room admin can remove members' }, 403);
  }

  const member = membersStore.get(memberId);
  if (!member || member.roomId !== roomId) {
    return c.json({ error: 'Member record not found' }, 404);
  }

  if (member.role === 'admin') {
    return c.json({ error: 'Cannot remove the room admin. Transfer admin responsibility first.' }, 400);
  }

  const updatedMember: MemberRecord = {
    ...member,
    status: 'departed',
    departedAt: new Date().toISOString(),
  };

  membersStore.set(memberId, updatedMember);
  logActivity(roomId, user.id, 'member_removed', { memberName: member.name });

  return c.json({ message: 'Member removed. Historical records preserved.', member: updatedMember });
});

// -------------------------------------------------------------
// POST /api/rooms/:roomId/transfer-admin
// Transfer admin role (Admin only)
// -------------------------------------------------------------
rooms.post('/:roomId/transfer-admin', async (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');
  const room = roomsStore.get(roomId);

  if (!room || room.adminId !== user.id) {
    return c.json({ error: 'Forbidden: only the current room admin can transfer the role' }, 403);
  }

  const body = await c.req.json().catch(() => null);
  const parseResult = transferAdminSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten().fieldErrors }, 400);
  }

  const { newAdminUserId } = parseResult.data;

  // Find target active member
  const targetMember = Array.from(membersStore.values()).find(
    (m) => m.roomId === roomId && m.userId === newAdminUserId && m.status === 'active'
  );

  if (!targetMember) {
    return c.json({ error: 'Target user must be an active member of this room' }, 404);
  }

  // Find current admin member record
  const currentAdminMember = Array.from(membersStore.values()).find(
    (m) => m.roomId === roomId && m.userId === user.id && m.status === 'active'
  );

  // Update room adminId
  roomsStore.set(roomId, {
    ...room,
    adminId: newAdminUserId,
    updatedAt: new Date().toISOString(),
  });

  // Swap member roles
  if (currentAdminMember) {
    membersStore.set(currentAdminMember.id, { ...currentAdminMember, role: 'member' });
  }
  membersStore.set(targetMember.id, { ...targetMember, role: 'admin' });

  logActivity(roomId, user.id, 'admin_transferred', {
    from: user.name,
    to: targetMember.name,
  });

  return c.json({
    message: `Admin responsibility successfully transferred to ${targetMember.name}`,
    newAdminId: newAdminUserId,
  });
});

// -------------------------------------------------------------
// PATCH /api/rooms/:roomId/collector
// Assign rent collector (Admin only)
// -------------------------------------------------------------
rooms.patch('/:roomId/collector', async (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');
  const room = roomsStore.get(roomId);

  if (!room || room.adminId !== user.id) {
    return c.json({ error: 'Forbidden: only the room admin can assign the rent collector' }, 403);
  }

  const body = await c.req.json().catch(() => null);
  const parseResult = assignCollectorSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten().fieldErrors }, 400);
  }

  const { collectorUserId } = parseResult.data;

  const targetMember = Array.from(membersStore.values()).find(
    (m) => m.roomId === roomId && m.userId === collectorUserId && m.status === 'active'
  );

  if (!targetMember) {
    return c.json({ error: 'Assigned collector must be an active member of this room' }, 404);
  }

  roomsStore.set(roomId, {
    ...room,
    collectorId: collectorUserId,
    updatedAt: new Date().toISOString(),
  });

  logActivity(roomId, user.id, 'collector_assigned', { collectorName: targetMember.name });

  return c.json({
    message: `${targetMember.name} is now the assigned rent collector`,
    collectorId: collectorUserId,
  });
});

export default rooms;
