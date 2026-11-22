import { Hono } from 'hono';
import { z } from 'zod';
import crypto from 'crypto';
import { authMiddleware } from '../middleware/auth';
import { AuthUser } from './auth';
import {
  roomsStore,
  membersStore,
  categoriesStore,
  CategoryRecord,
  logActivity,
} from './rooms';
import {
  notifyExpenseCreated,
  notifyExpenseUpdated,
  notifyExpenseDeleted,
} from '../services/notification-service';

export interface ExpenseRecord {
  id: string;
  roomId: string;
  name: string;
  amountPaise: number;
  categoryId: string;
  categoryName?: string;
  paidByUserId: string;
  paidByName?: string;
  expenseDate: string; // YYYY-MM-DD
  expensePeriod: string; // YYYY-MM
  settlementPeriod?: string | null;
  billingPeriodStart?: string | null; // YYYY-MM-DD
  billingPeriodEnd?: string | null; // YYYY-MM-DD
  settlementPreference: 'monthly' | 'immediate';
  settlementId?: string | null;
  createdByUserId: string;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseShareRecord {
  id: string;
  expenseId: string;
  userId: string;
  userName?: string;
  sharePaise: number;
  createdAt: string;
}

// In-memory expense and share store
export const expensesStore = new Map<string, ExpenseRecord>();
export const expenseSharesStore = new Map<string, ExpenseShareRecord[]>();

// -------------------------------------------------------------
// DETERMINISTIC PAISE SPLIT LOGIC
// Exactly distributes totalPaise among memberUserIds.
// Any remainder paise are deterministically awarded to the first members (alphabetical).
// Sum of returned sharePaise ALWAYS === totalPaise.
// -------------------------------------------------------------
export function calculateEqualPaiseShares(
  totalPaise: number,
  memberUserIds: string[]
): { userId: string; sharePaise: number }[] {
  if (memberUserIds.length === 0) return [];
  if (totalPaise <= 0) {
    return memberUserIds.map((userId) => ({ userId, sharePaise: 0 }));
  }

  // Sort deterministically
  const sortedIds = [...memberUserIds].sort();
  const count = sortedIds.length;
  const baseShare = Math.floor(totalPaise / count);
  const remainder = totalPaise % count;

  return sortedIds.map((userId, index) => ({
    userId,
    // First 'remainder' members receive +1 paise so the sum is exact
    sharePaise: baseShare + (index < remainder ? 1 : 0),
  }));
}

// Derive expense period (YYYY-MM).
// If multi-month billing period is given, assigned to the last month of that period.
export function deriveExpensePeriod(expenseDate: string, billingPeriodEnd?: string | null): string {
  if (billingPeriodEnd && billingPeriodEnd.length >= 7) {
    return billingPeriodEnd.slice(0, 7);
  }
  return expenseDate.slice(0, 7);
}

// -------------------------------------------------------------
// PRE-SEED DEMO EXPENSES FOR DEMO ROOM
// Flat 302, Green Glen (Room: r3023023-3023-3023-3023-302330233023)
// -------------------------------------------------------------
const DEMO_ROOM_ID = 'r3023023-3023-3023-3023-302330233023';
const RAHUL_ID = 'u1111111-1111-1111-1111-111111111111';
const AMAN_ID = 'u2222222-2222-2222-2222-222222222222';
const KUNAL_ID = 'u3333333-3333-3333-3333-333333333333';
const SAMEER_ID = 'u4444444-4444-4444-4444-444444444444';
const DEMO_MEMBERS = [RAHUL_ID, AMAN_ID, KUNAL_ID, SAMEER_ID];

(() => {
  const cats = categoriesStore.get(DEMO_ROOM_ID) || [];
  const getCatId = (name: string) => cats.find((c) => c.name.toLowerCase() === name.toLowerCase())?.id || 'default-cat';

  const demoExpensesData = [
    {
      id: 'e1001-rent-nov',
      name: 'Flat Monthly Rent',
      amountPaise: 2800000, // ₹28,000
      categoryId: getCatId('Rent'),
      categoryName: 'Rent',
      paidByUserId: RAHUL_ID,
      paidByName: 'Rahul Sharma',
      expenseDate: '2026-11-01',
      settlementPreference: 'monthly' as const,
    },
    {
      id: 'e1002-wifi-nov',
      name: 'Airtel Fiber Gigabit Wi-Fi',
      amountPaise: 119900, // ₹1,199
      categoryId: getCatId('Wi-Fi'),
      categoryName: 'Wi-Fi',
      paidByUserId: AMAN_ID,
      paidByName: 'Aman Verma',
      expenseDate: '2026-11-03',
      settlementPreference: 'monthly' as const,
    },
    {
      id: 'e1003-groceries',
      name: 'Monthly Grocery Essentials (Blinkit)',
      amountPaise: 245000, // ₹2,450
      categoryId: getCatId('Groceries'),
      categoryName: 'Groceries',
      paidByUserId: KUNAL_ID,
      paidByName: 'Kunal Patel',
      expenseDate: '2026-11-08',
      settlementPreference: 'monthly' as const,
    },
    {
      id: 'e1004-water-cans',
      name: 'Bisleri 20L Water Cans (6 cans)',
      amountPaise: 48000, // ₹480
      categoryId: getCatId('Water'),
      categoryName: 'Water',
      paidByUserId: SAMEER_ID,
      paidByName: 'Sameer Rao',
      expenseDate: '2026-11-12',
      settlementPreference: 'monthly' as const,
    },
    {
      id: 'e1005-electricity-multimonth',
      name: 'BESCOM Electricity Bill (Sep-Oct)',
      amountPaise: 360000, // ₹3,600
      categoryId: getCatId('Electricity'),
      categoryName: 'Electricity',
      paidByUserId: RAHUL_ID,
      paidByName: 'Rahul Sharma',
      expenseDate: '2026-11-15',
      billingPeriodStart: '2026-09-01',
      billingPeriodEnd: '2026-10-31',
      settlementPreference: 'monthly' as const,
    },
  ];

  for (const exp of demoExpensesData) {
    const expensePeriod = deriveExpensePeriod(exp.expenseDate, exp.billingPeriodEnd);
    const fullExpense: ExpenseRecord = {
      ...exp,
      roomId: DEMO_ROOM_ID,
      expensePeriod,
      settlementPeriod: expensePeriod,
      createdByUserId: exp.paidByUserId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expensesStore.set(exp.id, fullExpense);

    const shares = calculateEqualPaiseShares(exp.amountPaise, DEMO_MEMBERS).map((s) => ({
      id: crypto.randomUUID(),
      expenseId: exp.id,
      userId: s.userId,
      sharePaise: s.sharePaise,
      createdAt: new Date().toISOString(),
    }));
    expenseSharesStore.set(exp.id, shares);
  }
})();

// -------------------------------------------------------------
// VALIDATION SCHEMAS
// -------------------------------------------------------------
const createExpenseSchema = z.object({
  name: z.string().min(2, 'Expense name must be at least 2 characters').max(100),
  amountPaise: z.number().int().positive('Amount must be a positive integer in paise'),
  categoryId: z.string().min(1, 'Category is required'),
  paidByUserId: z.string().min(1, 'Paid by user is required'),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  settlementPreference: z.enum(['monthly', 'immediate']).default('monthly'),
  billingPeriodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format').optional().nullable(),
  billingPeriodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format').optional().nullable(),
});

const updateExpenseSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  amountPaise: z.number().int().positive().optional(),
  categoryId: z.string().min(1).optional(),
  paidByUserId: z.string().min(1).optional(),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  settlementPreference: z.enum(['monthly', 'immediate']).optional(),
  billingPeriodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  billingPeriodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

const createCategorySchema = z.object({
  name: z.string().min(2, 'Category name must be at least 2 characters').max(50),
});

const updateCategorySchema = z.object({
  name: z.string().min(2).max(50).optional(),
  isActive: z.boolean().optional(),
});

// -------------------------------------------------------------
// HONO ROUTER
// -------------------------------------------------------------
const expenses = new Hono<{ Variables: { user: AuthUser } }>();

// All expense routes require authentication
expenses.use('*', authMiddleware);

// Helper: Check if user is an active member of room
function checkRoomAccess(roomId: string, userId: string): { allowed: boolean; role?: 'admin' | 'member'; error?: string } {
  const room = roomsStore.get(roomId);
  if (!room || room.status === 'closed') {
    return { allowed: false, error: 'Room not found or closed' };
  }
  const member = Array.from(membersStore.values()).find(
    (m) => m.roomId === roomId && m.userId === userId && m.status === 'active'
  );
  if (!member) {
    return { allowed: false, error: 'Forbidden: you are not an active member of this room' };
  }
  return { allowed: true, role: member.role };
}

// -------------------------------------------------------------
// GET /api/rooms/:roomId/expenses
// List all active expenses for room (optional period & category filters)
// -------------------------------------------------------------
expenses.get('/:roomId/expenses', (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');

  const access = checkRoomAccess(roomId, user.id);
  if (!access.allowed) {
    return c.json({ error: access.error }, 403);
  }

  const period = c.req.query('period'); // YYYY-MM
  const categoryId = c.req.query('categoryId');
  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = parseInt(c.req.query('limit') || '50', 10);

  // Retrieve room members and categories for enriching names
  const members = Array.from(membersStore.values()).filter((m) => m.roomId === roomId);
  const memberNameMap = new Map(members.map((m) => [m.userId, m.name]));
  const categories = categoriesStore.get(roomId) || [];
  const categoryNameMap = new Map(categories.map((cat) => [cat.id, cat.name]));

  let roomExpenses = Array.from(expensesStore.values()).filter(
    (e) => e.roomId === roomId && !e.deletedAt
  );

  if (period) {
    roomExpenses = roomExpenses.filter((e) => e.expensePeriod === period);
  }

  if (categoryId) {
    roomExpenses = roomExpenses.filter((e) => e.categoryId === categoryId);
  }

  // Sort descending by expenseDate, then createdAt
  roomExpenses.sort((a, b) => {
    const dComp = b.expenseDate.localeCompare(a.expenseDate);
    if (dComp !== 0) return dComp;
    return b.createdAt.localeCompare(a.createdAt);
  });

  const totalCount = roomExpenses.length;
  const totalAmountPaise = roomExpenses.reduce((sum, e) => sum + e.amountPaise, 0);

  // Paginate
  const startIndex = (page - 1) * limit;
  const paginated = roomExpenses.slice(startIndex, startIndex + limit);

  // Enrich with category name, payer name, and shares
  const enrichedExpenses = paginated.map((e) => {
    const shares = expenseSharesStore.get(e.id) || [];
    return {
      ...e,
      categoryName: categoryNameMap.get(e.categoryId) || e.categoryName || 'General',
      paidByName: memberNameMap.get(e.paidByUserId) || e.paidByName || 'Roommate',
      shares: shares.map((s) => ({
        ...s,
        userName: memberNameMap.get(s.userId) || 'Roommate',
      })),
    };
  });

  return c.json({
    expenses: enrichedExpenses,
    totalCount,
    totalAmountPaise,
    period: period || 'all',
    page,
    limit,
  });
});

// -------------------------------------------------------------
// GET /api/rooms/:roomId/expenses/:expenseId
// Get details of a single expense with its share breakdown
// -------------------------------------------------------------
expenses.get('/:roomId/expenses/:expenseId', (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');
  const expenseId = c.req.param('expenseId');

  const access = checkRoomAccess(roomId, user.id);
  if (!access.allowed) {
    return c.json({ error: access.error }, 403);
  }

  const expense = expensesStore.get(expenseId);
  if (!expense || expense.roomId !== roomId || expense.deletedAt) {
    return c.json({ error: 'Expense not found' }, 404);
  }

  const members = Array.from(membersStore.values()).filter((m) => m.roomId === roomId);
  const memberNameMap = new Map(members.map((m) => [m.userId, m.name]));
  const categories = categoriesStore.get(roomId) || [];
  const categoryNameMap = new Map(categories.map((cat) => [cat.id, cat.name]));

  const rawShares = expenseSharesStore.get(expense.id) || [];
  const shares = rawShares.map((s) => ({
    ...s,
    userName: memberNameMap.get(s.userId) || 'Roommate',
  }));

  return c.json({
    expense: {
      ...expense,
      categoryName: categoryNameMap.get(expense.categoryId) || expense.categoryName || 'General',
      paidByName: memberNameMap.get(expense.paidByUserId) || expense.paidByName || 'Roommate',
    },
    shares,
  });
});

// -------------------------------------------------------------
// POST /api/rooms/:roomId/expenses
// Create a new expense and calculate equal deterministic paise shares
// -------------------------------------------------------------
expenses.post('/:roomId/expenses', async (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');

  const access = checkRoomAccess(roomId, user.id);
  if (!access.allowed) {
    return c.json({ error: access.error }, 403);
  }

  const body = await c.req.json().catch(() => null);
  const parseResult = createExpenseSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json(
      { error: 'Validation failed', details: parseResult.error.flatten().fieldErrors },
      400
    );
  }

  const data = parseResult.data;

  // Validate that paidByUserId is an active member
  const payerMember = Array.from(membersStore.values()).find(
    (m) => m.roomId === roomId && m.userId === data.paidByUserId && m.status === 'active'
  );
  if (!payerMember) {
    return c.json({ error: 'The paying roommate must be an active member of this room' }, 400);
  }

  // Get all active room members to split the expense
  const activeMembers = Array.from(membersStore.values()).filter(
    (m) => m.roomId === roomId && m.status === 'active'
  );
  if (activeMembers.length === 0) {
    return c.json({ error: 'Room has no active members to split expenses' }, 400);
  }

  const memberUserIds = activeMembers.map((m) => m.userId);
  const calculatedShares = calculateEqualPaiseShares(data.amountPaise, memberUserIds);

  const expenseId = crypto.randomUUID();
  const expensePeriod = deriveExpensePeriod(data.expenseDate, data.billingPeriodEnd);
  const now = new Date().toISOString();

  // Categories lookup
  const categories = categoriesStore.get(roomId) || [];
  const category = categories.find((cat) => cat.id === data.categoryId);

  const newExpense: ExpenseRecord = {
    id: expenseId,
    roomId,
    name: data.name.trim(),
    amountPaise: data.amountPaise,
    categoryId: data.categoryId,
    categoryName: category?.name || 'General',
    paidByUserId: data.paidByUserId,
    paidByName: payerMember.name,
    expenseDate: data.expenseDate,
    expensePeriod,
    settlementPeriod: expensePeriod,
    billingPeriodStart: data.billingPeriodStart || null,
    billingPeriodEnd: data.billingPeriodEnd || null,
    settlementPreference: data.settlementPreference,
    createdByUserId: user.id,
    createdAt: now,
    updatedAt: now,
  };

  const memberNameMap = new Map(activeMembers.map((m) => [m.userId, m.name]));
  const storedShares: ExpenseShareRecord[] = calculatedShares.map((s) => ({
    id: crypto.randomUUID(),
    expenseId,
    userId: s.userId,
    userName: memberNameMap.get(s.userId) || 'Roommate',
    sharePaise: s.sharePaise,
    createdAt: now,
  }));

  expensesStore.set(expenseId, newExpense);
  expenseSharesStore.set(expenseId, storedShares);

  // Audit activity log
  logActivity(roomId, user.id, 'expense_created', {
    expenseId,
    expenseName: newExpense.name,
    amountPaise: newExpense.amountPaise,
    paidBy: payerMember.name,
    memberCount: activeMembers.length,
    shares: storedShares.map((s) => ({ user: s.userName, sharePaise: s.sharePaise })),
  });

  // Broadcast push notification to roommates
  notifyExpenseCreated(roomId, newExpense, user);

  return c.json(
    {
      success: true,
      expense: newExpense,
      shares: storedShares,
    },
    201
  );
});

// -------------------------------------------------------------
// PATCH /api/rooms/:roomId/expenses/:expenseId
// Edit an existing expense (recalculates shares if amount changed)
// -------------------------------------------------------------
expenses.patch('/:roomId/expenses/:expenseId', async (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');
  const expenseId = c.req.param('expenseId');

  const access = checkRoomAccess(roomId, user.id);
  if (!access.allowed) {
    return c.json({ error: access.error }, 403);
  }

  const existingExpense = expensesStore.get(expenseId);
  if (!existingExpense || existingExpense.roomId !== roomId || existingExpense.deletedAt) {
    return c.json({ error: 'Expense not found or already deleted' }, 404);
  }

  const body = await c.req.json().catch(() => null);
  const parseResult = updateExpenseSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json(
      { error: 'Validation failed', details: parseResult.error.flatten().fieldErrors },
      400
    );
  }

  const updates = parseResult.data;
  const previousValues = {
    name: existingExpense.name,
    amountPaise: existingExpense.amountPaise,
    categoryId: existingExpense.categoryId,
    paidByUserId: existingExpense.paidByUserId,
    expenseDate: existingExpense.expenseDate,
  };

  let updatedPayerName = existingExpense.paidByName;
  if (updates.paidByUserId && updates.paidByUserId !== existingExpense.paidByUserId) {
    const payer = Array.from(membersStore.values()).find(
      (m) => m.roomId === roomId && m.userId === updates.paidByUserId && m.status === 'active'
    );
    if (!payer) {
      return c.json({ error: 'Assigned payer must be an active member of this room' }, 400);
    }
    updatedPayerName = payer.name;
  }

  let updatedCategoryName = existingExpense.categoryName;
  if (updates.categoryId && updates.categoryId !== existingExpense.categoryId) {
    const categories = categoriesStore.get(roomId) || [];
    const cat = categories.find((c) => c.id === updates.categoryId);
    if (cat) updatedCategoryName = cat.name;
  }

  const updatedDate = updates.expenseDate || existingExpense.expenseDate;
  const updatedEnd = updates.billingPeriodEnd !== undefined ? updates.billingPeriodEnd : existingExpense.billingPeriodEnd;
  const updatedPeriod = deriveExpensePeriod(updatedDate, updatedEnd);
  const now = new Date().toISOString();

  const finalAmount = updates.amountPaise !== undefined ? updates.amountPaise : existingExpense.amountPaise;

  // Recalculate shares if amount changed
  let updatedShares = expenseSharesStore.get(expenseId) || [];
  if (updates.amountPaise !== undefined && updates.amountPaise !== existingExpense.amountPaise) {
    const activeMembers = Array.from(membersStore.values()).filter(
      (m) => m.roomId === roomId && m.status === 'active'
    );
    const memberNameMap = new Map(activeMembers.map((m) => [m.userId, m.name]));
    const calculated = calculateEqualPaiseShares(finalAmount, activeMembers.map((m) => m.userId));

    updatedShares = calculated.map((s) => ({
      id: crypto.randomUUID(),
      expenseId,
      userId: s.userId,
      userName: memberNameMap.get(s.userId) || 'Roommate',
      sharePaise: s.sharePaise,
      createdAt: now,
    }));
    expenseSharesStore.set(expenseId, updatedShares);
  }

  const updatedExpense: ExpenseRecord = {
    ...existingExpense,
    name: updates.name !== undefined ? updates.name.trim() : existingExpense.name,
    amountPaise: finalAmount,
    categoryId: updates.categoryId || existingExpense.categoryId,
    categoryName: updatedCategoryName,
    paidByUserId: updates.paidByUserId || existingExpense.paidByUserId,
    paidByName: updatedPayerName,
    expenseDate: updatedDate,
    expensePeriod: updatedPeriod,
    settlementPeriod: updatedPeriod,
    billingPeriodStart: updates.billingPeriodStart !== undefined ? updates.billingPeriodStart : existingExpense.billingPeriodStart,
    billingPeriodEnd: updatedEnd,
    settlementPreference: updates.settlementPreference || existingExpense.settlementPreference,
    updatedAt: now,
  };

  expensesStore.set(expenseId, updatedExpense);

  // Activity audit log
  logActivity(roomId, user.id, 'expense_updated', {
    expenseId,
    previousValues,
    updatedValues: updates,
  });

  // Broadcast push notification to roommates
  notifyExpenseUpdated(roomId, updatedExpense, user);

  return c.json({
    success: true,
    expense: updatedExpense,
    shares: updatedShares,
  });
});

// -------------------------------------------------------------
// DELETE /api/rooms/:roomId/expenses/:expenseId
// Soft-delete an expense
// -------------------------------------------------------------
expenses.delete('/:roomId/expenses/:expenseId', (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');
  const expenseId = c.req.param('expenseId');

  const access = checkRoomAccess(roomId, user.id);
  if (!access.allowed) {
    return c.json({ error: access.error }, 403);
  }

  const existingExpense = expensesStore.get(expenseId);
  if (!existingExpense || existingExpense.roomId !== roomId || existingExpense.deletedAt) {
    return c.json({ error: 'Expense not found or already deleted' }, 404);
  }

  const now = new Date().toISOString();
  expensesStore.set(expenseId, {
    ...existingExpense,
    deletedAt: now,
    updatedAt: now,
  });

  logActivity(roomId, user.id, 'expense_deleted', {
    expenseId,
    expenseName: existingExpense.name,
    amountPaise: existingExpense.amountPaise,
  });

  // Broadcast push notification to roommates
  notifyExpenseDeleted(roomId, existingExpense.name, user);

  return c.json({
    success: true,
    message: 'Expense deleted successfully',
    deletedId: expenseId,
  });
});

// -------------------------------------------------------------
// CATEGORIES ROUTES
// GET /api/rooms/:roomId/categories
// POST /api/rooms/:roomId/categories (Admin only)
// PATCH /api/rooms/:roomId/categories/:categoryId (Admin only)
// -------------------------------------------------------------
expenses.get('/:roomId/categories', (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');

  const access = checkRoomAccess(roomId, user.id);
  if (!access.allowed) {
    return c.json({ error: access.error }, 403);
  }

  const cats = categoriesStore.get(roomId) || [];
  return c.json({ categories: cats });
});

expenses.post('/:roomId/categories', async (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');

  const access = checkRoomAccess(roomId, user.id);
  if (!access.allowed) {
    return c.json({ error: access.error }, 403);
  }
  if (access.role !== 'admin') {
    return c.json({ error: 'Forbidden: only the room admin can add custom categories' }, 403);
  }

  const body = await c.req.json().catch(() => null);
  const parseResult = createCategorySchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten().fieldErrors }, 400);
  }

  const existingCats = categoriesStore.get(roomId) || [];
  const normalizedName = parseResult.data.name.trim();

  if (existingCats.some((c) => c.name.toLowerCase() === normalizedName.toLowerCase())) {
    return c.json({ error: 'A category with this name already exists' }, 409);
  }

  const newCat: CategoryRecord = {
    id: crypto.randomUUID(),
    roomId,
    name: normalizedName,
    isDefault: false,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  existingCats.push(newCat);
  categoriesStore.set(roomId, existingCats);

  logActivity(roomId, user.id, 'category_created', { categoryName: newCat.name });

  return c.json({ success: true, category: newCat }, 201);
});

expenses.patch('/:roomId/categories/:categoryId', async (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');
  const categoryId = c.req.param('categoryId');

  const access = checkRoomAccess(roomId, user.id);
  if (!access.allowed) {
    return c.json({ error: access.error }, 403);
  }
  if (access.role !== 'admin') {
    return c.json({ error: 'Forbidden: only the room admin can modify categories' }, 403);
  }

  const body = await c.req.json().catch(() => null);
  const parseResult = updateCategorySchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten().fieldErrors }, 400);
  }

  const existingCats = categoriesStore.get(roomId) || [];
  const catIndex = existingCats.findIndex((c) => c.id === categoryId);
  if (catIndex === -1) {
    return c.json({ error: 'Category not found' }, 404);
  }

  const updates = parseResult.data;
  const updatedCategory = {
    ...existingCats[catIndex],
    name: updates.name !== undefined ? updates.name.trim() : existingCats[catIndex].name,
    isActive: updates.isActive !== undefined ? updates.isActive : existingCats[catIndex].isActive,
  };

  existingCats[catIndex] = updatedCategory;
  categoriesStore.set(roomId, existingCats);

  logActivity(roomId, user.id, 'category_updated', {
    categoryName: updatedCategory.name,
    isActive: updatedCategory.isActive,
  });

  return c.json({ success: true, category: updatedCategory });
});

// -------------------------------------------------------------
// DELETE /api/rooms/:roomId/categories/:categoryId (Admin only)
// Soft-disables if category has associated expenses, or removes if unused
// -------------------------------------------------------------
expenses.delete('/:roomId/categories/:categoryId', (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');
  const categoryId = c.req.param('categoryId');

  const access = checkRoomAccess(roomId, user.id);
  if (!access.allowed) {
    return c.json({ error: access.error }, 403);
  }
  if (access.role !== 'admin') {
    return c.json({ error: 'Forbidden: only the room admin can delete or disable categories' }, 403);
  }

  const existingCats = categoriesStore.get(roomId) || [];
  const catIndex = existingCats.findIndex((c) => c.id === categoryId);
  if (catIndex === -1) {
    return c.json({ error: 'Category not found' }, 404);
  }

  const category = existingCats[catIndex];
  const isUsed = Array.from(expensesStore.values()).some(
    (e) => e.roomId === roomId && e.categoryId === categoryId && !e.deletedAt
  );

  if (isUsed || category.isDefault) {
    category.isActive = false;
    existingCats[catIndex] = category;
    categoriesStore.set(roomId, existingCats);
    logActivity(roomId, user.id, 'category_disabled', { categoryName: category.name });
    return c.json({ success: true, action: 'disabled', message: 'Category is in use and has been disabled' });
  }

  existingCats.splice(catIndex, 1);
  categoriesStore.set(roomId, existingCats);
  logActivity(roomId, user.id, 'category_deleted', { categoryName: category.name });
  return c.json({ success: true, action: 'deleted', message: 'Category removed' });
});

export default expenses;
