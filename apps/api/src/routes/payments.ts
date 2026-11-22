import { Hono } from 'hono';
import { z } from 'zod';
import crypto from 'crypto';
import { authMiddleware } from '../middleware/auth';
import { AuthUser } from './auth';
import { roomsStore, membersStore, logActivity } from './rooms';
import { settlementsStore, settlementSharesStore } from './settlements';
import {
  notifyPaymentSent,
  notifyPaymentConfirmed,
  notifyPaymentReversed,
} from '../services/notification-service';

export interface PaymentRecord {
  id: string;
  roomId: string;
  settlementId: string;
  payerUserId: string;
  payerName: string;
  collectorUserId: string;
  collectorName: string;
  amountPaise: number;
  method: 'upi' | 'cash';
  status: 'sent' | 'confirmed' | 'cancelled' | 'reversed';
  sentAt: string;
  confirmedAt?: string | null;
  cancelledAt?: string | null;
  reversedAt?: string | null;
  reversalReason?: string | null;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface LandlordPaymentRecord {
  id: string;
  roomId: string;
  settlementId: string;
  paidByUserId: string;
  paidByName: string;
  amountPaise: number;
  method: 'upi' | 'cash';
  paidAt: string;
  createdAt: string;
}

// In-memory payment stores
export const paymentsStore = new Map<string, PaymentRecord>();
export const landlordPaymentsStore = new Map<string, LandlordPaymentRecord>();
const idempotencyKeyMap = new Map<string, string>(); // idempotencyKey -> paymentId

// -------------------------------------------------------------
// PRE-SEED HISTORICAL PAYMENTS FOR FLAT 302 (October 2026)
// -------------------------------------------------------------
const DEMO_ROOM_ID = 'r3023023-3023-3023-3023-302330233023';
const RAHUL_ID = 'u1111111-1111-1111-1111-111111111111';
const AMAN_ID = 'u2222222-2222-2222-2222-222222222222';
const KUNAL_ID = 'u3333333-3333-3333-3333-333333333333';
const SAMEER_ID = 'u4444444-4444-4444-4444-444444444444';
const OCT_SETTLEMENT_ID = 'set-2026-10-flat302';

(() => {
  const octDate = '2026-10-31T20:30:00.000Z';

  // 1. Rahul (Collector) own net payment: ₹4,300 (Auto-confirmed)
  const p1: PaymentRecord = {
    id: 'pay-oct-rahul',
    roomId: DEMO_ROOM_ID,
    settlementId: OCT_SETTLEMENT_ID,
    payerUserId: RAHUL_ID,
    payerName: 'Rahul Sharma',
    collectorUserId: RAHUL_ID,
    collectorName: 'Rahul Sharma',
    amountPaise: 430000,
    method: 'upi',
    status: 'confirmed',
    sentAt: octDate,
    confirmedAt: octDate,
    idempotencyKey: 'idem-oct-rahul',
    createdAt: octDate,
    updatedAt: octDate,
  };
  paymentsStore.set(p1.id, p1);

  // 2. Aman payment: ₹7,900 (UPI)
  const p2: PaymentRecord = {
    id: 'pay-oct-aman',
    roomId: DEMO_ROOM_ID,
    settlementId: OCT_SETTLEMENT_ID,
    payerUserId: AMAN_ID,
    payerName: 'Aman Verma',
    collectorUserId: RAHUL_ID,
    collectorName: 'Rahul Sharma',
    amountPaise: 790000,
    method: 'upi',
    status: 'confirmed',
    sentAt: octDate,
    confirmedAt: octDate,
    idempotencyKey: 'idem-oct-aman',
    createdAt: octDate,
    updatedAt: octDate,
  };
  paymentsStore.set(p2.id, p2);

  // 3. Kunal payment: ₹7,900 (UPI)
  const p3: PaymentRecord = {
    id: 'pay-oct-kunal',
    roomId: DEMO_ROOM_ID,
    settlementId: OCT_SETTLEMENT_ID,
    payerUserId: KUNAL_ID,
    payerName: 'Kunal Patel',
    collectorUserId: RAHUL_ID,
    collectorName: 'Rahul Sharma',
    amountPaise: 790000,
    method: 'upi',
    status: 'confirmed',
    sentAt: octDate,
    confirmedAt: octDate,
    idempotencyKey: 'idem-oct-kunal',
    createdAt: octDate,
    updatedAt: octDate,
  };
  paymentsStore.set(p3.id, p3);

  // 4. Sameer payment: ₹7,900 (Cash)
  const p4: PaymentRecord = {
    id: 'pay-oct-sameer',
    roomId: DEMO_ROOM_ID,
    settlementId: OCT_SETTLEMENT_ID,
    payerUserId: SAMEER_ID,
    payerName: 'Sameer Rao',
    collectorUserId: RAHUL_ID,
    collectorName: 'Rahul Sharma',
    amountPaise: 790000,
    method: 'cash',
    status: 'confirmed',
    sentAt: octDate,
    confirmedAt: octDate,
    idempotencyKey: 'idem-oct-sameer',
    createdAt: octDate,
    updatedAt: octDate,
  };
  paymentsStore.set(p4.id, p4);

  // 5. Landlord rent payment: ₹28,000 via Net Banking / UPI
  const lp1: LandlordPaymentRecord = {
    id: 'lp-oct-landlord',
    roomId: DEMO_ROOM_ID,
    settlementId: OCT_SETTLEMENT_ID,
    paidByUserId: RAHUL_ID,
    paidByName: 'Rahul Sharma',
    amountPaise: 2800000,
    method: 'upi',
    paidAt: octDate,
    createdAt: octDate,
  };
  landlordPaymentsStore.set(lp1.id, lp1);
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

// -------------------------------------------------------------
// VALIDATION SCHEMAS
// -------------------------------------------------------------
const sendPaymentSchema = z.object({
  settlementId: z.string().min(1, 'Settlement ID is required'),
  amountPaise: z.number().int().positive('Payment amount must be a positive integer in paise'),
  method: z.enum(['upi', 'cash']),
  idempotencyKey: z.string().min(1, 'Idempotency key is required'),
});

const reversePaymentSchema = z.object({
  reason: z.string().min(3, 'Reversal reason must be at least 3 characters'),
});

const landlordPaymentSchema = z.object({
  settlementId: z.string().min(1, 'Settlement ID is required'),
  amountPaise: z.number().int().positive('Amount must be positive integer paise'),
  method: z.enum(['upi', 'cash']),
  paidAt: z.string().optional(),
});

// -------------------------------------------------------------
// HONO ROUTER
// -------------------------------------------------------------
const payments = new Hono<{ Variables: { user: AuthUser } }>();

payments.use('*', authMiddleware);

// -------------------------------------------------------------
// GET /api/rooms/:roomId/payments
// List all payments and landlord payouts for the room
// -------------------------------------------------------------
payments.get('/:roomId/payments', (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');
  const settlementId = c.req.query('settlementId');

  const access = checkRoomAccess(roomId, user.id);
  if (!access.allowed) {
    return c.json({ error: access.error }, 403);
  }

  let list = Array.from(paymentsStore.values()).filter((p) => p.roomId === roomId);
  let landlordList = Array.from(landlordPaymentsStore.values()).filter((lp) => lp.roomId === roomId);

  if (settlementId) {
    list = list.filter((p) => p.settlementId === settlementId);
    landlordList = landlordList.filter((lp) => lp.settlementId === settlementId);
  }

  // Sort descending by sentAt
  list.sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  landlordList.sort((a, b) => b.paidAt.localeCompare(a.paidAt));

  return c.json({
    payments: list,
    landlordPayments: landlordList,
  });
});

// -------------------------------------------------------------
// GET /api/rooms/:roomId/payments/pending
// List pending payments awaiting confirmation (Collector view)
// -------------------------------------------------------------
payments.get('/:roomId/payments/pending', (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');

  const access = checkRoomAccess(roomId, user.id);
  if (!access.allowed) {
    return c.json({ error: access.error }, 403);
  }

  const pending = Array.from(paymentsStore.values()).filter(
    (p) => p.roomId === roomId && p.status === 'sent'
  );

  return c.json({ pendingPayments: pending, count: pending.length });
});

// -------------------------------------------------------------
// POST /api/rooms/:roomId/payments
// Mark payment as sent (roommate -> collector)
// Enforces full payment only & auto-confirms collector's own payment
// -------------------------------------------------------------
payments.post('/:roomId/payments', async (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');

  const access = checkRoomAccess(roomId, user.id);
  if (!access.allowed) {
    return c.json({ error: access.error }, 403);
  }

  const body = await c.req.json().catch(() => null);
  const parseResult = sendPaymentSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json(
      { error: 'Validation failed', details: parseResult.error.flatten().fieldErrors },
      400
    );
  }

  const data = parseResult.data;

  // Check idempotency
  if (idempotencyKeyMap.has(data.idempotencyKey)) {
    const existingId = idempotencyKeyMap.get(data.idempotencyKey)!;
    const existingPayment = paymentsStore.get(existingId);
    if (existingPayment) {
      return c.json({ success: true, payment: existingPayment, idempotent: true }, 200);
    }
  }

  const room = access.room!;
  const collector = Array.from(membersStore.values()).find(
    (m) => m.roomId === roomId && m.userId === room.collectorId
  );
  const collectorName = collector?.name || 'Rent Collector';

  // Validate full payment only rule
  // Check member shares for this settlement
  const shares = settlementSharesStore.get(data.settlementId) || [];
  const myShare = shares.find((s) => s.userId === user.id);

  if (myShare) {
    const outstanding = myShare.amountOwedPaise - myShare.amountPaidPaise;
    if (data.amountPaise !== outstanding && outstanding > 0) {
      return c.json(
        {
          error: `Full payment required. Expected ₹${(outstanding / 100).toLocaleString('en-IN')}, received ₹${(data.amountPaise / 100).toLocaleString('en-IN')}`,
          expectedAmountPaise: outstanding,
        },
        400
      );
    }
  }

  const now = new Date().toISOString();
  const paymentId = crypto.randomUUID();

  // Collector's own payment is auto-confirmed immediately
  const isCollectorSelf = user.id === room.collectorId;
  const status = isCollectorSelf ? 'confirmed' : 'sent';
  const confirmedAt = isCollectorSelf ? now : null;

  const newPayment: PaymentRecord = {
    id: paymentId,
    roomId,
    settlementId: data.settlementId,
    payerUserId: user.id,
    payerName: user.name,
    collectorUserId: room.collectorId,
    collectorName,
    amountPaise: data.amountPaise,
    method: data.method,
    status,
    sentAt: now,
    confirmedAt,
    idempotencyKey: data.idempotencyKey,
    createdAt: now,
    updatedAt: now,
  };

  paymentsStore.set(paymentId, newPayment);
  idempotencyKeyMap.set(data.idempotencyKey, paymentId);

  // Update settlement member share if confirmed
  if (isCollectorSelf && myShare) {
    myShare.amountPaidPaise += data.amountPaise;
  }

  // Audit activity log
  logActivity(roomId, user.id, isCollectorSelf ? 'payment_confirmed' : 'payment_sent', {
    paymentId,
    settlementId: data.settlementId,
    amountPaise: data.amountPaise,
    method: data.method,
    payer: user.name,
    collector: collectorName,
    autoConfirmed: isCollectorSelf,
  });

  // Broadcast push notification
  if (isCollectorSelf) {
    notifyPaymentConfirmed(roomId, newPayment, user);
  } else {
    notifyPaymentSent(roomId, newPayment, user);
  }

  return c.json({ success: true, payment: newPayment }, 201);
});

// -------------------------------------------------------------
// POST /api/rooms/:roomId/payments/:paymentId/confirm
// Confirm payment receipt (Collector only)
// -------------------------------------------------------------
payments.post('/:roomId/payments/:paymentId/confirm', (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');
  const paymentId = c.req.param('paymentId');

  const access = checkRoomAccess(roomId, user.id);
  if (!access.allowed) {
    return c.json({ error: access.error }, 403);
  }

  const room = access.room!;
  // Only the assigned collector or admin can confirm payments
  if (user.id !== room.collectorId && user.id !== room.adminId) {
    return c.json({ error: 'Forbidden: only the assigned rent collector can confirm payments' }, 403);
  }

  const payment = paymentsStore.get(paymentId);
  if (!payment || payment.roomId !== roomId) {
    return c.json({ error: 'Payment not found' }, 404);
  }

  if (payment.status !== 'sent') {
    return c.json({ error: `Cannot confirm payment with status '${payment.status}'` }, 400);
  }

  const now = new Date().toISOString();
  payment.status = 'confirmed';
  payment.confirmedAt = now;
  payment.updatedAt = now;

  // Update settlement share
  const shares = settlementSharesStore.get(payment.settlementId) || [];
  const payerShare = shares.find((s) => s.userId === payment.payerUserId);
  if (payerShare) {
    payerShare.amountPaidPaise += payment.amountPaise;
  }

  logActivity(roomId, user.id, 'payment_confirmed', {
    paymentId,
    amountPaise: payment.amountPaise,
    payer: payment.payerName,
    confirmedBy: user.name,
  });

  // Broadcast push notification
  notifyPaymentConfirmed(roomId, payment, user);

  return c.json({ success: true, payment });
});

// -------------------------------------------------------------
// POST /api/rooms/:roomId/payments/:paymentId/cancel
// Cancel a sent payment before confirmation (Payer only)
// -------------------------------------------------------------
payments.post('/:roomId/payments/:paymentId/cancel', (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');
  const paymentId = c.req.param('paymentId');

  const access = checkRoomAccess(roomId, user.id);
  if (!access.allowed) {
    return c.json({ error: access.error }, 403);
  }

  const payment = paymentsStore.get(paymentId);
  if (!payment || payment.roomId !== roomId) {
    return c.json({ error: 'Payment not found' }, 404);
  }

  if (payment.payerUserId !== user.id) {
    return c.json({ error: 'Forbidden: only the payer can cancel their sent payment' }, 403);
  }

  if (payment.status !== 'sent') {
    return c.json({ error: 'Only unconfirmed pending payments can be cancelled' }, 400);
  }

  const now = new Date().toISOString();
  payment.status = 'cancelled';
  payment.cancelledAt = now;
  payment.updatedAt = now;

  logActivity(roomId, user.id, 'payment_cancelled', {
    paymentId,
    amountPaise: payment.amountPaise,
    payer: user.name,
  });

  return c.json({ success: true, payment });
});

// -------------------------------------------------------------
// POST /api/rooms/:roomId/payments/:paymentId/reverse
// Reverse a confirmed payment (Collector only, reason required)
// -------------------------------------------------------------
payments.post('/:roomId/payments/:paymentId/reverse', async (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');
  const paymentId = c.req.param('paymentId');

  const access = checkRoomAccess(roomId, user.id);
  if (!access.allowed) {
    return c.json({ error: access.error }, 403);
  }

  const room = access.room!;
  if (user.id !== room.collectorId && user.id !== room.adminId) {
    return c.json({ error: 'Forbidden: only the rent collector can reverse payments' }, 403);
  }

  const payment = paymentsStore.get(paymentId);
  if (!payment || payment.roomId !== roomId) {
    return c.json({ error: 'Payment not found' }, 404);
  }

  if (payment.status !== 'confirmed') {
    return c.json({ error: 'Only confirmed payments can be reversed' }, 400);
  }

  const body = await c.req.json().catch(() => null);
  const parseResult = reversePaymentSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: 'Reversal reason is required', details: parseResult.error.flatten().fieldErrors }, 400);
  }

  const now = new Date().toISOString();
  payment.status = 'reversed';
  payment.reversedAt = now;
  payment.reversalReason = parseResult.data.reason;
  payment.updatedAt = now;

  // Deduct from settlement share
  const shares = settlementSharesStore.get(payment.settlementId) || [];
  const payerShare = shares.find((s) => s.userId === payment.payerUserId);
  if (payerShare) {
    payerShare.amountPaidPaise = Math.max(0, payerShare.amountPaidPaise - payment.amountPaise);
  }

  logActivity(roomId, user.id, 'payment_reversed', {
    paymentId,
    amountPaise: payment.amountPaise,
    payer: payment.payerName,
    reversedBy: user.name,
    reason: parseResult.data.reason,
  });

  // Broadcast push notification
  notifyPaymentReversed(roomId, payment, user, parseResult.data.reason);

  return c.json({ success: true, payment });
});

// -------------------------------------------------------------
// POST /api/rooms/:roomId/landlord-payments
// Record payout to property landlord (Collector only)
// -------------------------------------------------------------
payments.post('/:roomId/landlord-payments', async (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');

  const access = checkRoomAccess(roomId, user.id);
  if (!access.allowed) {
    return c.json({ error: access.error }, 403);
  }

  const room = access.room!;
  if (user.id !== room.collectorId && user.id !== room.adminId) {
    return c.json({ error: 'Forbidden: only the rent collector can record landlord payments' }, 403);
  }

  const body = await c.req.json().catch(() => null);
  const parseResult = landlordPaymentSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten().fieldErrors }, 400);
  }

  const data = parseResult.data;
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const record: LandlordPaymentRecord = {
    id,
    roomId,
    settlementId: data.settlementId,
    paidByUserId: user.id,
    paidByName: user.name,
    amountPaise: data.amountPaise,
    method: data.method,
    paidAt: data.paidAt || now,
    createdAt: now,
  };

  landlordPaymentsStore.set(id, record);

  logActivity(roomId, user.id, 'landlord_payment_recorded', {
    landlordPaymentId: id,
    settlementId: data.settlementId,
    amountPaise: data.amountPaise,
    method: data.method,
    recordedBy: user.name,
  });

  return c.json({ success: true, landlordPayment: record }, 201);
});

export default payments;
