import { Hono } from 'hono';
import crypto from 'crypto';
import { authMiddleware, getAuthUser } from '../middleware/auth';
import { roomsStore, membersStore, roomActivityLog } from './rooms';

const activity = new Hono();

activity.use('*', authMiddleware);

export interface ActivityItem {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  userEmail?: string;
  action: string;
  entityType: 'expense' | 'payment' | 'settlement' | 'water' | 'room' | 'member';
  title: string;
  description: string;
  details: Record<string, any>;
  deepLink?: string;
  createdAt: string;
}

// Format paise for titles & descriptions
function formatPaiseStr(paise: number): string {
  if (typeof paise !== 'number' || isNaN(paise)) return '₹0';
  const rupees = Math.round(paise / 100);
  return '₹' + rupees.toLocaleString('en-IN');
}

// Map action string to entityType
export function getEntityType(action: string): ActivityItem['entityType'] {
  if (action.startsWith('expense_') || action === 'category_created') return 'expense';
  if (action.startsWith('payment_') || action === 'landlord_payment_recorded') return 'payment';
  if (action.startsWith('settlement_')) return 'settlement';
  if (action.startsWith('water_') || action.startsWith('service_')) return 'water';
  if (action.startsWith('member_') || action === 'join_requested') return 'member';
  return 'room';
}

// Convert raw log to rich human-readable ActivityItem
export function enrichActivity(log: any, roomId: string): ActivityItem {
  const details = log.details || {};
  const action = log.action || 'activity_recorded';
  const entityType = getEntityType(action);

  // Actor name lookup
  const members = Array.from(membersStore.values()).filter((m) => m.roomId === roomId);
  const member = members.find((m) => m.userId === log.userId);
  const userName =
    member?.name ||
    details.recordedBy ||
    details.confirmedBy ||
    details.payer ||
    details.userName ||
    details.deletedBy ||
    details.updatedBy ||
    'Flatmate';
  const userEmail = member?.email || details.email;

  let title = 'Activity Recorded';
  let description = `${userName} performed an action`;
  let deepLink: string | undefined = undefined;

  switch (action) {
    // Expense Actions
    case 'expense_created':
      title = `Added expense '${details.expenseName || 'Bill'}' (${formatPaiseStr(details.amountPaise || 0)})`;
      description = `${userName} paid ${formatPaiseStr(details.amountPaise || 0)} for ${details.expenseName || 'shared expense'}`;
      deepLink = details.expenseId ? `/expense-detail?id=${details.expenseId}` : '/(tabs)/expenses';
      break;

    case 'expense_updated': {
      const expName = details.updatedValues?.name || details.previousValues?.name || 'Expense';
      title = `Updated expense '${expName}'`;
      const prevAmt = details.previousValues?.amountPaise;
      const newAmt = details.updatedValues?.amountPaise;
      if (prevAmt !== undefined && newAmt !== undefined && prevAmt !== newAmt) {
        description = `${userName} changed amount from ${formatPaiseStr(prevAmt)} to ${formatPaiseStr(newAmt)}`;
      } else {
        description = `${userName} updated expense details`;
      }
      deepLink = details.expenseId ? `/expense-detail?id=${details.expenseId}` : '/(tabs)/expenses';
      break;
    }

    case 'expense_deleted':
      title = `Deleted expense '${details.expenseName || 'Bill'}'`;
      description = `${userName} removed ${details.expenseName || 'expense'} (${formatPaiseStr(details.amountPaise || 0)})`;
      deepLink = '/(tabs)/expenses';
      break;

    case 'category_created':
      title = `Created category '${details.categoryName}'`;
      description = `${userName} created a new expense category`;
      deepLink = '/room-settings';
      break;

    // Payment Actions
    case 'payment_sent':
      title = `Sent payment of ${formatPaiseStr(details.amountPaise || 0)}`;
      description = `${details.payer || userName} submitted payment via ${details.method || 'UPI'}`;
      deepLink = '/collector-confirmations';
      break;

    case 'payment_confirmed':
      title = `Confirmed payment of ${formatPaiseStr(details.amountPaise || 0)}`;
      description = `${details.confirmedBy || userName} confirmed receipt from ${details.payer || 'Roommate'}`;
      deepLink = '/payment-history';
      break;

    case 'payment_cancelled':
      title = `Cancelled payment of ${formatPaiseStr(details.amountPaise || 0)}`;
      description = `${details.payer || userName} cancelled pending payment submission`;
      deepLink = '/payment-history';
      break;

    case 'payment_reversed':
      title = `Reversed payment of ${formatPaiseStr(details.amountPaise || 0)}`;
      description = `Reversed by ${details.reversedBy || userName}: "${details.reason || 'Incorrect transfer'}"`;
      deepLink = '/payment-history';
      break;

    case 'landlord_payment_recorded':
      title = `Recorded Landlord Rent Payout (${formatPaiseStr(details.amountPaise || 0)})`;
      description = `${details.recordedBy || userName} paid full room rent to landlord via ${details.method || 'bank_transfer'}`;
      deepLink = '/payment-history';
      break;

    // Settlement Actions
    case 'settlement_finalized':
      title = `Finalized Settlement for ${details.period || 'Monthly Cycle'}`;
      description = `Locked cycle: Rent ${formatPaiseStr(details.totalRentPaise || 0)} + Expenses ${formatPaiseStr(details.totalExpensesPaise || 0)} = ${formatPaiseStr(details.grandTotalPaise || 0)}`;
      deepLink = '/statement-detail';
      break;

    // Water & Services Actions
    case 'water_delivery_recorded':
      title = `Logged 1 Water Delivery (${formatPaiseStr(details.pricePaise || 4000)})`;
      description = `${details.recordedBy || userName} recorded delivery at ${details.deliveryTime || '09:00'} on ${details.deliveryDate || 'Today'}`;
      deepLink = '/water-delivery';
      break;

    case 'water_deliveries_bulk_recorded':
      title = `Bulk logged ${details.count || 2} water cans`;
      description = `${details.recordedBy || userName} backdated multiple water can deliveries`;
      deepLink = '/water-delivery';
      break;

    case 'water_delivery_deleted':
      title = `Deleted water delivery record`;
      description = `${details.deletedBy || userName} removed water can for ${details.deliveryDate || 'delivery'}`;
      deepLink = '/water-delivery';
      break;

    case 'service_price_updated':
      title = `Updated ${details.serviceType || 'service'} rate to ${formatPaiseStr(details.pricePaise || 0)}`;
      description = `${details.updatedBy || userName} set new price effective from ${details.effectiveFrom || 'next cycle'}`;
      deepLink = '/service-config';
      break;

    // Room & Member Actions
    case 'room_created':
      title = `Created room '${details.name || 'Flat'}'`;
      description = `${userName} established room with rent of ${formatPaiseStr(details.monthlyRentPaise || 0)}/mo`;
      deepLink = '/room-settings';
      break;

    case 'room_updated':
      title = `Updated room configuration`;
      description = `${userName} modified room settings`;
      deepLink = '/room-settings';
      break;

    case 'collector_assigned':
      title = `Assigned Rent Collector`;
      description = `${details.collectorName || 'Roommate'} was designated as active rent collector`;
      deepLink = '/room-settings';
      break;

    case 'admin_transferred':
      title = `Transferred Room Admin`;
      description = `Ownership transferred from ${details.from || userName} to ${details.to || 'New Admin'}`;
      deepLink = '/room-settings';
      break;

    case 'invite_generated':
      title = `Generated Room Invite`;
      description = `${userName} created a 7-day shareable invite link`;
      deepLink = '/invite-modal';
      break;

    case 'join_requested':
      title = `Roommate Join Request`;
      description = `${details.userName || userName} (${details.email || ''}) requested to join`;
      deepLink = '/(tabs)/room';
      break;

    case 'member_approved':
      title = `Approved New Roommate`;
      description = `${details.memberName || 'New roommate'} joined the flat`;
      deepLink = '/(tabs)/room';
      break;

    case 'member_removed':
      title = `Departed Roommate`;
      description = `${details.memberName || 'Roommate'} departed. Historical records preserved.`;
      deepLink = '/(tabs)/room';
      break;

    default:
      title = action.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
      description = `${userName} updated room data`;
      break;
  }

  return {
    id: log.id || crypto.randomUUID(),
    roomId,
    userId: log.userId,
    userName,
    userEmail,
    action,
    entityType,
    title,
    description,
    details,
    deepLink,
    createdAt: log.createdAt || new Date().toISOString(),
  };
}

// Pre-seed demo activity history for Flat 302
const DEMO_ROOM_ID = 'r3023023-3023-3023-3023-302330233023';
const RAHUL_ID = 'u1111111-1111-1111-1111-111111111111';
const AMAN_ID = 'u2222222-2222-2222-2222-222222222222';
const KUNAL_ID = 'u3333333-3333-3333-3333-333333333333';
const SAMEER_ID = 'u4444444-4444-4444-4444-444444444444';

(() => {
  const existing = roomActivityLog.get(DEMO_ROOM_ID) || [];
  if (existing.length < 5) {
    const seededActivities = [
      // Today (2026-11-20)
      {
        id: 'act-20',
        roomId: DEMO_ROOM_ID,
        userId: RAHUL_ID,
        action: 'water_delivery_recorded',
        details: { deliveryId: 'wd-nov-9', deliveryDate: '2026-11-20', deliveryTime: '11:15', pricePaise: 4000, recordedBy: 'Rahul Sharma' },
        createdAt: '2026-11-20T11:15:00.000Z',
      },
      {
        id: 'act-19',
        roomId: DEMO_ROOM_ID,
        userId: AMAN_ID,
        action: 'payment_sent',
        details: { paymentId: 'pay-nov-aman', settlementId: 'draft-r3023023-2026-11', amountPaise: 631225, method: 'UPI', payer: 'Aman Verma' },
        createdAt: '2026-11-20T10:45:00.000Z',
      },
      {
        id: 'act-18',
        roomId: DEMO_ROOM_ID,
        userId: RAHUL_ID,
        action: 'expense_created',
        details: { expenseId: 'exp-groceries-3', expenseName: 'Milk & Eggs', amountPaise: 28000, paidBy: 'Rahul Sharma', memberCount: 4 },
        createdAt: '2026-11-20T09:30:00.000Z',
      },

      // Yesterday (2026-11-19)
      {
        id: 'act-17',
        roomId: DEMO_ROOM_ID,
        userId: AMAN_ID,
        action: 'expense_updated',
        details: {
          expenseId: 'exp-nov-wifi',
          previousValues: { name: 'Airtel Wi-Fi', amountPaise: 139900 },
          updatedValues: { name: 'Airtel Xstream Fiber (300 Mbps)', amountPaise: 159900 },
        },
        createdAt: '2026-11-19T18:20:00.000Z',
      },
      {
        id: 'act-16',
        roomId: DEMO_ROOM_ID,
        userId: RAHUL_ID,
        action: 'water_delivery_recorded',
        details: { deliveryId: 'wd-nov-8', deliveryDate: '2026-11-19', deliveryTime: '09:00', pricePaise: 4000, recordedBy: 'Rahul Sharma' },
        createdAt: '2026-11-19T09:00:00.000Z',
      },

      // This Week
      {
        id: 'act-15',
        roomId: DEMO_ROOM_ID,
        userId: RAHUL_ID,
        action: 'collector_assigned',
        details: { collectorName: 'Rahul Sharma' },
        createdAt: '2026-11-16T15:00:00.000Z',
      },
      {
        id: 'act-14',
        roomId: DEMO_ROOM_ID,
        userId: AMAN_ID,
        action: 'expense_created',
        details: { expenseId: 'exp-maid-cook', expenseName: 'Maid & Cook Monthly Salary', amountPaise: 600000, paidBy: 'Aman Verma', memberCount: 4 },
        createdAt: '2026-11-15T12:00:00.000Z',
      },
      {
        id: 'act-13',
        roomId: DEMO_ROOM_ID,
        userId: RAHUL_ID,
        action: 'service_price_updated',
        details: { serviceType: 'water', pricePaise: 4000, effectiveFrom: '2026-11-01', updatedBy: 'Rahul Sharma' },
        createdAt: '2026-11-14T11:00:00.000Z',
      },
      {
        id: 'act-12',
        roomId: DEMO_ROOM_ID,
        userId: KUNAL_ID,
        action: 'expense_created',
        details: { expenseId: 'exp-groceries-bulk', expenseName: 'Nature Basket Groceries', amountPaise: 345000, paidBy: 'Kunal Patel', memberCount: 4 },
        createdAt: '2026-11-12T19:30:00.000Z',
      },
      {
        id: 'act-11',
        roomId: DEMO_ROOM_ID,
        userId: RAHUL_ID,
        action: 'water_deliveries_bulk_recorded',
        details: { count: 3, recordedBy: 'Rahul Sharma' },
        createdAt: '2026-11-11T10:15:00.000Z',
      },

      // Earlier This Month (Nov 1 - Nov 10)
      {
        id: 'act-10',
        roomId: DEMO_ROOM_ID,
        userId: SAMEER_ID,
        action: 'expense_created',
        details: { expenseId: 'exp-cleaner-supplies', expenseName: 'Cleaning Supplies & Detergent', amountPaise: 108000, paidBy: 'Sameer Rao', memberCount: 4 },
        createdAt: '2026-11-06T14:40:00.000Z',
      },
      {
        id: 'act-9',
        roomId: DEMO_ROOM_ID,
        userId: RAHUL_ID,
        action: 'category_created',
        details: { categoryName: 'Gas Cylinder' },
        createdAt: '2026-11-04T16:00:00.000Z',
      },
      {
        id: 'act-8',
        roomId: DEMO_ROOM_ID,
        userId: RAHUL_ID,
        action: 'invite_generated',
        details: { token: 'inv-demo-7day-token' },
        createdAt: '2026-11-02T10:00:00.000Z',
      },

      // October 2026 (Finalized Settlement & Payments)
      {
        id: 'act-7',
        roomId: DEMO_ROOM_ID,
        userId: RAHUL_ID,
        action: 'landlord_payment_recorded',
        details: { settlementId: 'set-2026-10-flat302', amountPaise: 2800000, method: 'bank_transfer', recordedBy: 'Rahul Sharma' },
        createdAt: '2026-10-31T18:00:00.000Z',
      },
      {
        id: 'act-6',
        roomId: DEMO_ROOM_ID,
        userId: RAHUL_ID,
        action: 'payment_confirmed',
        details: { paymentId: 'pay-oct-kunal', amountPaise: 790000, payer: 'Kunal Patel', confirmedBy: 'Rahul Sharma' },
        createdAt: '2026-10-31T17:15:00.000Z',
      },
      {
        id: 'act-5',
        roomId: DEMO_ROOM_ID,
        userId: RAHUL_ID,
        action: 'payment_confirmed',
        details: { paymentId: 'pay-oct-aman', amountPaise: 790000, payer: 'Aman Verma', confirmedBy: 'Rahul Sharma' },
        createdAt: '2026-10-31T17:00:00.000Z',
      },
      {
        id: 'act-4',
        roomId: DEMO_ROOM_ID,
        userId: RAHUL_ID,
        action: 'payment_confirmed',
        details: { paymentId: 'pay-oct-sameer', amountPaise: 790000, payer: 'Sameer Rao', confirmedBy: 'Rahul Sharma' },
        createdAt: '2026-10-31T16:50:00.000Z',
      },
      {
        id: 'act-3',
        roomId: DEMO_ROOM_ID,
        userId: RAHUL_ID,
        action: 'settlement_finalized',
        details: {
          settlementId: 'set-2026-10-flat302',
          period: '2026-10',
          totalRentPaise: 2800000,
          totalExpensesPaise: 360000,
          grandTotalPaise: 3160000,
        },
        createdAt: '2026-10-31T15:30:00.000Z',
      },
      {
        id: 'act-2',
        roomId: DEMO_ROOM_ID,
        userId: SAMEER_ID,
        action: 'member_approved',
        details: { memberName: 'Sameer Rao' },
        createdAt: '2026-10-01T12:00:00.000Z',
      },
      {
        id: 'act-1',
        roomId: DEMO_ROOM_ID,
        userId: RAHUL_ID,
        action: 'room_created',
        details: { name: 'Flat 302, Green Glen', monthlyRentPaise: 2800000 },
        createdAt: '2026-10-01T10:00:00.000Z',
      },
    ];

    roomActivityLog.set(DEMO_ROOM_ID, [...existing, ...seededActivities]);
  }
})();

// Helper to check room access
function checkRoomAccess(roomId: string, userId: string): { allowed: boolean; status?: 403 | 404; error?: string } {
  const room = roomsStore.get(roomId);
  if (!room || room.status === 'closed') {
    return { allowed: false, status: 404, error: 'Room not found or closed' };
  }
  const member = Array.from(membersStore.values()).find(
    (m) => m.roomId === roomId && m.userId === userId && m.status === 'active'
  );
  if (!member) {
    return { allowed: false, status: 403, error: 'Forbidden: you are not an active member of this room' };
  }
  return { allowed: true };
}

/**
 * GET /api/rooms/:roomId/activity
 * Paginated, filterable activity history and audit log
 */
activity.get('/:roomId/activity', async (c) => {
  const user = getAuthUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const roomId = c.req.param('roomId');
  const access = checkRoomAccess(roomId, user.id);
  if (!access.allowed) {
    return c.json({ error: access.error }, access.status || 403);
  }

  const rawLogs = roomActivityLog.get(roomId) || [];

  // Enrich all logs
  const allActivities = rawLogs.map((log) => enrichActivity(log, roomId));

  // Compute filter counts
  const filterCounts = {
    all: allActivities.length,
    expenses: allActivities.filter((a) => a.entityType === 'expense').length,
    payments: allActivities.filter((a) => a.entityType === 'payment').length,
    settlements: allActivities.filter((a) => a.entityType === 'settlement').length,
    water: allActivities.filter((a) => a.entityType === 'water').length,
    room: allActivities.filter((a) => a.entityType === 'room' || a.entityType === 'member').length,
  };

  // Filter parameter
  const filter = (c.req.query('filter') || 'all').toLowerCase();
  let filtered = allActivities;

  if (filter === 'expenses') {
    filtered = allActivities.filter((a) => a.entityType === 'expense');
  } else if (filter === 'payments') {
    filtered = allActivities.filter((a) => a.entityType === 'payment');
  } else if (filter === 'settlements') {
    filtered = allActivities.filter((a) => a.entityType === 'settlement');
  } else if (filter === 'water') {
    filtered = allActivities.filter((a) => a.entityType === 'water');
  } else if (filter === 'room') {
    filtered = allActivities.filter((a) => a.entityType === 'room' || a.entityType === 'member');
  }

  // Filter by user if specified
  const filterUserId = c.req.query('userId');
  if (filterUserId) {
    filtered = filtered.filter((a) => a.userId === filterUserId);
  }

  // Pagination
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20', 10)));
  const offset = (page - 1) * limit;

  const paginated = filtered.slice(offset, offset + limit);
  const total = filtered.length;
  const totalPages = Math.ceil(total / limit);
  const hasMore = offset + limit < total;

  return c.json({
    success: true,
    activities: paginated,
    logs: allActivities,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore,
    },
    filterCounts,
  });
});

/**
 * GET /api/rooms/:roomId/activity/:id
 * Retrieve single activity log entry detail
 */
activity.get('/:roomId/activity/:id', async (c) => {
  const user = getAuthUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const roomId = c.req.param('roomId');
  const access = checkRoomAccess(roomId, user.id);
  if (!access.allowed) {
    return c.json({ error: access.error }, access.status || 403);
  }

  const activityId = c.req.param('id');
  const rawLogs = roomActivityLog.get(roomId) || [];
  const found = rawLogs.find((l) => l.id === activityId);

  if (!found) {
    return c.json({ error: 'Activity record not found' }, 404);
  }

  const enriched = enrichActivity(found, roomId);
  return c.json({
    success: true,
    activity: enriched,
  });
});

export default activity;
