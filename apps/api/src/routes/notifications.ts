import { Hono } from 'hono';
import { authMiddleware, getAuthUser } from '../middleware/auth';
import {
  registerPushToken,
  getPushToken,
  notificationHistoryStore,
  sendRoomNotification,
  NotificationEventType,
} from '../services/notification-service';
import { roomsStore, membersStore } from './rooms';

const notifications = new Hono();

// Notification routes require authentication
notifications.use('/token', authMiddleware);
notifications.use('/rooms/:roomId/notifications', authMiddleware);
notifications.use('/rooms/:roomId/notifications/*', authMiddleware);

/**
 * POST /api/notifications/token
 * Register or update the authenticated user's Expo Push Token
 */
notifications.post('/token', async (c) => {
  const user = getAuthUser(c);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json().catch(() => ({}));
  const token = body.token;

  if (!token || typeof token !== 'string') {
    return c.json({ error: 'Token is required and must be a string' }, 400);
  }

  registerPushToken(user.id, token);

  return c.json({
    success: true,
    message: 'Push token successfully registered',
    userId: user.id,
    token,
  });
});

/**
 * GET /api/notifications/token
 * Retrieve current registered push token for the user
 */
notifications.get('/token', async (c) => {
  const user = getAuthUser(c);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = getPushToken(user.id);
  return c.json({
    userId: user.id,
    token: token || null,
  });
});

/**
 * GET /api/rooms/:roomId/notifications
 * Get room activity notification history for the user
 */
notifications.get('/rooms/:roomId/notifications', async (c) => {
  const user = getAuthUser(c);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const roomId = c.req.param('roomId');
  const room = roomsStore.get(roomId);
  if (!room) {
    return c.json({ error: 'Room not found' }, 404);
  }

  // Check room membership
  const member = Array.from(membersStore.values()).find(
    (m) => m.roomId === roomId && m.userId === user.id && m.status === 'active'
  );
  if (!member) {
    return c.json({ error: 'Forbidden: you are not an active member of this room' }, 403);
  }

  // Filter notifications relevant to this room and user
  const userNotifs = notificationHistoryStore.filter(
    (n) =>
      n.roomId === roomId &&
      (n.recipientUserId === user.id || n.recipientUserId === 'all' || n.senderUserId === user.id)
  );

  return c.json({
    notifications: userNotifs.slice(0, 50),
    total: userNotifs.length,
    notificationsEnabled: room.notificationsEnabled,
  });
});

/**
 * POST /api/rooms/:roomId/notifications/test
 * Fire a test push notification across any of the 7 event types
 */
notifications.post('/rooms/:roomId/notifications/test', async (c) => {
  const user = getAuthUser(c);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const roomId = c.req.param('roomId');
  const room = roomsStore.get(roomId);
  if (!room) {
    return c.json({ error: 'Room not found' }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const eventType: NotificationEventType = body.eventType || 'expense_created';

  const titles: Record<NotificationEventType, string> = {
    expense_created: 'New Expense Added',
    expense_updated: 'Expense Updated',
    expense_deleted: 'Expense Deleted',
    settlement_finalized: 'Settlement Finalized 🔒',
    payment_sent: 'Payment Sent — Awaiting Confirmation',
    payment_confirmed: 'Payment Confirmed! 🎉',
    payment_reversed: 'Payment Reversed ⚠️',
    water_delivery_logged: 'Water Can Delivered 💧',
  };

  const bodies: Record<NotificationEventType, string> = {
    expense_created: `${user.name} added Blinkit Groceries: ₹2,450`,
    expense_updated: `${user.name} updated Wi-Fi Bill: ₹1,199`,
    expense_deleted: `${user.name} removed expense: Bisleri Water`,
    settlement_finalized: 'November 2026 settlement locked (₹34,749 total). Check your share.',
    payment_sent: `${user.name} sent payment of ₹4,250. Please confirm.`,
    payment_confirmed: `${user.name} confirmed your payment of ₹4,250.`,
    payment_reversed: 'Payment of ₹4,250 reversed: "Bank transfer failed"',
    water_delivery_logged: `${user.name} logged 1 water can delivery (₹40).`,
  };

  const urls: Record<NotificationEventType, string> = {
    expense_created: '/(tabs)/expenses',
    expense_updated: '/(tabs)/expenses',
    expense_deleted: '/(tabs)/expenses',
    settlement_finalized: '/statement-detail',
    payment_sent: '/collector-confirmations',
    payment_confirmed: '/payment-history',
    payment_reversed: '/payment-history',
    water_delivery_logged: '/water-delivery',
  };

  const result = await sendRoomNotification({
    roomId,
    senderUserId: body.includeSender ? undefined : user.id,
    targetUserId: body.targetUserId,
    eventType,
    title: body.title || titles[eventType],
    body: body.body || bodies[eventType],
    data: {
      eventType,
      roomId,
      url: body.url || urls[eventType],
      test: true,
    },
  });

  return c.json({
    success: true,
    ...result,
  });
});

export default notifications;
