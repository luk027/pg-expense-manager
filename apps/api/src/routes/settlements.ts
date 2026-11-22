import { Hono } from 'hono';
import { z } from 'zod';
import crypto from 'crypto';
import { authMiddleware } from '../middleware/auth';
import { AuthUser } from './auth';
import { roomsStore, membersStore, logActivity } from './rooms';
import { notifySettlementFinalized } from '../services/notification-service';
import { expensesStore, expenseSharesStore } from './expenses';
import {
  calculateSettlement,
  SettlementCalculationInput,
  SettlementStatement,
  SettlementMemberInput,
  SettlementExpenseInput,
} from '../services/settlement-engine';

export interface SettlementRecord {
  id: string;
  roomId: string;
  period: string; // YYYY-MM
  status: 'draft' | 'finalized';
  finalizedByUserId?: string | null;
  finalizedByName?: string | null;
  finalizedAt?: string | null;
  totalRentPaise: number;
  totalExpensesPaise: number;
  totalCarriedForwardPaise: number;
  totalAdjustmentsPaise: number;
  grandTotalPaise: number;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SettlementMemberShareRecord {
  id: string;
  settlementId: string;
  userId: string;
  userName: string;
  rentSharePaise: number;
  expenseSharePaise: number;
  carriedForwardPaise: number;
  adjustmentPaise: number;
  totalSharePaise: number;
  expensePaidPaise: number;
  amountOwedPaise: number;
  amountPaidPaise: number;
  createdAt: string;
  updatedAt: string;
}

// In-memory settlement and share stores
export const settlementsStore = new Map<string, SettlementRecord>();
export const settlementSharesStore = new Map<string, SettlementMemberShareRecord[]>();

// -------------------------------------------------------------
// PRE-SEED HISTORICAL SETTLEMENT FOR FLAT 302
// Room: r3023023-3023-3023-3023-302330233023 (Flat 302, Green Glen)
// Pre-seed October 2026 (2026-10) as finalized
// -------------------------------------------------------------
const DEMO_ROOM_ID = 'r3023023-3023-3023-3023-302330233023';
const RAHUL_ID = 'u1111111-1111-1111-1111-111111111111';
const AMAN_ID = 'u2222222-2222-2222-2222-222222222222';
const KUNAL_ID = 'u3333333-3333-3333-3333-333333333333';
const SAMEER_ID = 'u4444444-4444-4444-4444-444444444444';

(() => {
  const octSettlementId = 'set-2026-10-flat302';
  const finalizedAt = '2026-10-31T20:00:00.000Z';

  // October 2026: Rent ₹28,000 (2,800,000) + Bi-monthly power ₹3,600 (360,000) = ₹31,600 (3,160,000)
  // 4 roommates: ₹7,900 (790,000) each
  const octRecord: SettlementRecord = {
    id: octSettlementId,
    roomId: DEMO_ROOM_ID,
    period: '2026-10',
    status: 'finalized',
    finalizedByUserId: RAHUL_ID,
    finalizedByName: 'Rahul Sharma',
    finalizedAt,
    totalRentPaise: 2800000,
    totalExpensesPaise: 360000,
    totalCarriedForwardPaise: 0,
    totalAdjustmentsPaise: 0,
    grandTotalPaise: 3160000,
    memberCount: 4,
    createdAt: finalizedAt,
    updatedAt: finalizedAt,
  };

  settlementsStore.set(octSettlementId, octRecord);

  const octMemberShares: SettlementMemberShareRecord[] = [
    {
      id: 'sms-oct-u1',
      settlementId: octSettlementId,
      userId: RAHUL_ID,
      userName: 'Rahul Sharma',
      rentSharePaise: 700000,
      expenseSharePaise: 90000,
      carriedForwardPaise: 0,
      adjustmentPaise: 0,
      totalSharePaise: 790000,
      expensePaidPaise: 360000, // Rahul paid the ₹3,600 electricity bill
      amountOwedPaise: 430000, // 790,000 - 360,000 = ₹4,300
      amountPaidPaise: 430000,
      createdAt: finalizedAt,
      updatedAt: finalizedAt,
    },
    {
      id: 'sms-oct-u2',
      settlementId: octSettlementId,
      userId: AMAN_ID,
      userName: 'Aman Verma',
      rentSharePaise: 700000,
      expenseSharePaise: 90000,
      carriedForwardPaise: 0,
      adjustmentPaise: 0,
      totalSharePaise: 790000,
      expensePaidPaise: 0,
      amountOwedPaise: 790000,
      amountPaidPaise: 790000,
      createdAt: finalizedAt,
      updatedAt: finalizedAt,
    },
    {
      id: 'sms-oct-u3',
      settlementId: octSettlementId,
      userId: KUNAL_ID,
      userName: 'Kunal Patel',
      rentSharePaise: 700000,
      expenseSharePaise: 90000,
      carriedForwardPaise: 0,
      adjustmentPaise: 0,
      totalSharePaise: 790000,
      expensePaidPaise: 0,
      amountOwedPaise: 790000,
      amountPaidPaise: 790000,
      createdAt: finalizedAt,
      updatedAt: finalizedAt,
    },
    {
      id: 'sms-oct-u4',
      settlementId: octSettlementId,
      userId: SAMEER_ID,
      userName: 'Sameer Rao',
      rentSharePaise: 700000,
      expenseSharePaise: 90000,
      carriedForwardPaise: 0,
      adjustmentPaise: 0,
      totalSharePaise: 790000,
      expensePaidPaise: 0,
      amountOwedPaise: 790000,
      amountPaidPaise: 790000,
      createdAt: finalizedAt,
      updatedAt: finalizedAt,
    },
  ];

  settlementSharesStore.set(octSettlementId, octMemberShares);
})();

// Helper to check room access
function checkRoomAccess(roomId: string, userId: string) {
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
  return { allowed: true, role: member.role, member, room };
}

// Helper: Compile inputs and run settlement engine
function computeRoomSettlement(roomId: string, period: string): SettlementStatement {
  const room = roomsStore.get(roomId);
  const monthlyRent = room?.monthlyRentPaise || 0;

  // Active or departed room members
  const members = Array.from(membersStore.values())
    .filter((m) => m.roomId === roomId)
    .map((m) => ({
      userId: m.userId,
      name: m.name,
      joinedAt: m.joinedAt || m.createdAt,
      departedAt: m.departedAt,
      status: m.status as 'active' | 'departed',
    }));

  // Room expenses
  const expenses = Array.from(expensesStore.values())
    .filter((e) => e.roomId === roomId && !e.deletedAt)
    .map((e) => {
      const shares = expenseSharesStore.get(e.id) || [];
      return {
        id: e.id,
        name: e.name,
        amountPaise: e.amountPaise,
        paidByUserId: e.paidByUserId,
        expenseDate: e.expenseDate,
        expensePeriod: e.expensePeriod,
        billingPeriodStart: e.billingPeriodStart,
        billingPeriodEnd: e.billingPeriodEnd,
        settlementPreference: e.settlementPreference,
        shares: shares.map((s) => ({ userId: s.userId, sharePaise: s.sharePaise })),
        deletedAt: e.deletedAt,
      };
    });

  return calculateSettlement({
    roomId,
    period,
    monthlyRentPaise: monthlyRent,
    members,
    expenses,
  });
}

// -------------------------------------------------------------
// HONO ROUTER
// -------------------------------------------------------------
const settlements = new Hono<{ Variables: { user: AuthUser } }>();

settlements.use('*', authMiddleware);

const periodRegex = /^\d{4}-\d{2}$/;

// -------------------------------------------------------------
// GET /api/rooms/:roomId/settlements
// List all settlements for the room (both finalized and current draft summary)
// -------------------------------------------------------------
settlements.get('/:roomId/settlements', (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');

  const access = checkRoomAccess(roomId, user.id);
  if (!access.allowed) {
    return c.json({ error: access.error }, 403);
  }

  // Find all stored settlements for this room
  const storedList = Array.from(settlementsStore.values()).filter(
    (s) => s.roomId === roomId
  );

  // If current month (e.g. 2026-11) is not finalized yet, generate a draft summary
  const currentPeriod = new Date().toISOString().slice(0, 7);
  const hasCurrentPeriod = storedList.some((s) => s.period === currentPeriod);

  if (!hasCurrentPeriod) {
    const draftStatement = computeRoomSettlement(roomId, currentPeriod);
    const draftSummary: SettlementRecord = {
      id: `draft-${roomId}-${currentPeriod}`,
      roomId,
      period: currentPeriod,
      status: 'draft',
      totalRentPaise: draftStatement.totalRentPaise,
      totalExpensesPaise: draftStatement.totalExpensesPaise,
      totalCarriedForwardPaise: draftStatement.totalCarriedForwardPaise,
      totalAdjustmentsPaise: draftStatement.totalAdjustmentsPaise,
      grandTotalPaise: draftStatement.grandTotalPaise,
      memberCount: draftStatement.memberCount,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    storedList.push(draftSummary);
  }

  // Sort chronologically descending
  storedList.sort((a, b) => b.period.localeCompare(a.period));

  return c.json({ settlements: storedList });
});

// -------------------------------------------------------------
// GET /api/rooms/:roomId/settlements/:period
// Get settlement details for a specific period (YYYY-MM)
// Returns finalized settlement if locked, or real-time draft
// -------------------------------------------------------------
settlements.get('/:roomId/settlements/:period', (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');
  const period = c.req.param('period');

  if (!periodRegex.test(period)) {
    return c.json({ error: 'Invalid period format. Must be YYYY-MM' }, 400);
  }

  const access = checkRoomAccess(roomId, user.id);
  if (!access.allowed) {
    return c.json({ error: access.error }, 403);
  }

  // Check if finalized record exists
  const stored = Array.from(settlementsStore.values()).find(
    (s) => s.roomId === roomId && s.period === period
  );

  if (stored && stored.status === 'finalized') {
    const shares = settlementSharesStore.get(stored.id) || [];
    return c.json({
      settlement: stored,
      isFinalized: true,
      memberShares: shares,
    });
  }

  // Otherwise, compute real-time draft
  const statement = computeRoomSettlement(roomId, period);
  const draftRecord: SettlementRecord = {
    id: `draft-${roomId}-${period}`,
    roomId,
    period,
    status: 'draft',
    totalRentPaise: statement.totalRentPaise,
    totalExpensesPaise: statement.totalExpensesPaise,
    totalCarriedForwardPaise: statement.totalCarriedForwardPaise,
    totalAdjustmentsPaise: statement.totalAdjustmentsPaise,
    grandTotalPaise: statement.grandTotalPaise,
    memberCount: statement.memberCount,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const draftShares: SettlementMemberShareRecord[] = statement.memberStatements.map((m) => ({
    id: `draft-share-${m.userId}`,
    settlementId: draftRecord.id,
    userId: m.userId,
    userName: m.name,
    rentSharePaise: m.rentSharePaise,
    expenseSharePaise: m.expenseSharePaise,
    carriedForwardPaise: m.carriedForwardPaise,
    adjustmentPaise: m.adjustmentPaise,
    totalSharePaise: m.totalSharePaise,
    expensePaidPaise: m.expensePaidPaise,
    amountOwedPaise: m.netAmountOwedPaise,
    amountPaidPaise: 0,
    createdAt: draftRecord.createdAt,
    updatedAt: draftRecord.updatedAt,
  }));

  return c.json({
    settlement: draftRecord,
    isFinalized: false,
    memberShares: draftShares,
  });
});

// -------------------------------------------------------------
// POST /api/rooms/:roomId/settlements/:period/finalize
// Finalize a settlement for the period (locks all shares)
// -------------------------------------------------------------
settlements.post('/:roomId/settlements/:period/finalize', async (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');
  const period = c.req.param('period');

  if (!periodRegex.test(period)) {
    return c.json({ error: 'Invalid period format. Must be YYYY-MM' }, 400);
  }

  const access = checkRoomAccess(roomId, user.id);
  if (!access.allowed) {
    return c.json({ error: access.error }, 403);
  }

  // Check if already finalized
  const existing = Array.from(settlementsStore.values()).find(
    (s) => s.roomId === roomId && s.period === period && s.status === 'finalized'
  );

  if (existing) {
    return c.json(
      {
        error: `Settlement for period ${period} is already finalized`,
        settlement: existing,
      },
      400
    );
  }

  // Compute exact statement via settlement engine
  const statement = computeRoomSettlement(roomId, period);
  const settlementId = crypto.randomUUID();
  const now = new Date().toISOString();

  const finalizedSettlement: SettlementRecord = {
    id: settlementId,
    roomId,
    period,
    status: 'finalized',
    finalizedByUserId: user.id,
    finalizedByName: user.name,
    finalizedAt: now,
    totalRentPaise: statement.totalRentPaise,
    totalExpensesPaise: statement.totalExpensesPaise,
    totalCarriedForwardPaise: statement.totalCarriedForwardPaise,
    totalAdjustmentsPaise: statement.totalAdjustmentsPaise,
    grandTotalPaise: statement.grandTotalPaise,
    memberCount: statement.memberCount,
    createdAt: now,
    updatedAt: now,
  };

  const storedShares: SettlementMemberShareRecord[] = statement.memberStatements.map((m) => ({
    id: crypto.randomUUID(),
    settlementId,
    userId: m.userId,
    userName: m.name,
    rentSharePaise: m.rentSharePaise,
    expenseSharePaise: m.expenseSharePaise,
    carriedForwardPaise: m.carriedForwardPaise,
    adjustmentPaise: m.adjustmentPaise,
    totalSharePaise: m.totalSharePaise,
    expensePaidPaise: m.expensePaidPaise,
    amountOwedPaise: m.netAmountOwedPaise,
    amountPaidPaise: 0,
    createdAt: now,
    updatedAt: now,
  }));

  settlementsStore.set(settlementId, finalizedSettlement);
  settlementSharesStore.set(settlementId, storedShares);

  // Audit activity log
  logActivity(roomId, user.id, 'settlement_finalized', {
    settlementId,
    period,
    grandTotalPaise: statement.grandTotalPaise,
    totalRentPaise: statement.totalRentPaise,
    totalExpensesPaise: statement.totalExpensesPaise,
    finalizedBy: user.name,
    memberShares: storedShares.map((s) => ({
      roommate: s.userName,
      owedPaise: s.amountOwedPaise,
    })),
  });

  // Broadcast push notification to roommates
  notifySettlementFinalized(roomId, finalizedSettlement, user);

  return c.json(
    {
      success: true,
      message: `Settlement for ${period} successfully finalized and locked`,
      settlement: finalizedSettlement,
      memberShares: storedShares,
    },
    201
  );
});

// -------------------------------------------------------------
// GET /api/rooms/:roomId/settlements/:period/statement
// Get full itemized settlement statement (line items + member breakdowns)
// -------------------------------------------------------------
settlements.get('/:roomId/settlements/:period/statement', (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');
  const period = c.req.param('period');

  if (!periodRegex.test(period)) {
    return c.json({ error: 'Invalid period format. Must be YYYY-MM' }, 400);
  }

  const access = checkRoomAccess(roomId, user.id);
  if (!access.allowed) {
    return c.json({ error: access.error }, 403);
  }

  // Calculate or retrieve full statement
  const statement = computeRoomSettlement(roomId, period);

  // Check if locked
  const stored = Array.from(settlementsStore.values()).find(
    (s) => s.roomId === roomId && s.period === period && s.status === 'finalized'
  );

  return c.json({
    status: stored ? 'finalized' : 'draft',
    finalizedAt: stored?.finalizedAt || null,
    finalizedByName: stored?.finalizedByName || null,
    statement,
  });
});

export default settlements;
