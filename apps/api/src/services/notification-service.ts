import { roomsStore, membersStore } from '../routes/rooms';

export type NotificationEventType =
  | 'expense_created'
  | 'expense_updated'
  | 'expense_deleted'
  | 'settlement_finalized'
  | 'payment_sent'
  | 'payment_confirmed'
  | 'payment_reversed'
  | 'water_delivery_logged';

export interface NotificationRecord {
  id: string;
  roomId: string;
  recipientUserId: string;
  senderUserId?: string;
  eventType: NotificationEventType;
  title: string;
  body: string;
  data: {
    eventType: NotificationEventType;
    roomId: string;
    url: string;
    [key: string]: any;
  };
  pushToken?: string;
  status: 'sent' | 'delivered' | 'failed' | 'suppressed';
  createdAt: string;
}

export function formatPaise(paise: number): string {
  const rupees = Math.round(paise / 100);
  return '₹' + rupees.toLocaleString('en-IN');
}

// In-memory token store: userId -> expoPushToken
export const userPushTokensStore = new Map<string, string>([
  ['u1111111-1111-1111-1111-111111111111', 'ExponentPushToken[mock-rahul-token]'],
  ['u2222222-2222-2222-2222-222222222222', 'ExponentPushToken[mock-aman-token]'],
  ['u3333333-3333-3333-3333-333333333333', 'ExponentPushToken[mock-kunal-token]'],
  ['u4444444-4444-4444-4444-444444444444', 'ExponentPushToken[mock-sameer-token]'],
]);

// Notification history store
export const notificationHistoryStore: NotificationRecord[] = [];

/**
 * Register or update a user's Expo push token
 */
export function registerPushToken(userId: string, token: string): void {
  userPushTokensStore.set(userId, token);
}

/**
 * Get a user's Expo push token
 */
export function getPushToken(userId: string): string | undefined {
  return userPushTokensStore.get(userId);
}

/**
 * Dispatches an Expo Push Notification to a token
 */
async function sendExpoPushNotification(message: {
  to: string;
  title: string;
  body: string;
  data: any;
}): Promise<boolean> {
  // If it's a mock token, simulate successful delivery
  if (message.to.startsWith('ExponentPushToken[mock-') || message.to.startsWith('ExpoPushToken[mock-')) {
    return true;
  }

  // Validate Expo push token format
  const isExpoToken = /^Expo(nent)?PushToken\[.*\]$/.test(message.to);
  if (!isExpoToken) {
    return false;
  }

  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: message.to,
        sound: 'default',
        title: message.title,
        body: message.body,
        data: message.data,
        badge: 1,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to dispatch Expo push notification:', err);
    return false;
  }
}

/**
 * Core broadcast method: Sends notifications to room members, respecting room notification settings
 */
export async function sendRoomNotification(options: {
  roomId: string;
  senderUserId?: string;
  targetUserId?: string;
  eventType: NotificationEventType;
  title: string;
  body: string;
  data: {
    eventType: NotificationEventType;
    roomId: string;
    url: string;
    [key: string]: any;
  };
}): Promise<{ sentCount: number; suppressed: boolean; notifications: NotificationRecord[] }> {
  const room = roomsStore.get(options.roomId);
  if (!room) {
    return { sentCount: 0, suppressed: false, notifications: [] };
  }

  // Check room-level notification toggle (under Room Settings)
  if (!room.notificationsEnabled) {
    const suppressedRecord: NotificationRecord = {
      id: crypto.randomUUID(),
      roomId: options.roomId,
      recipientUserId: options.targetUserId || 'all',
      senderUserId: options.senderUserId,
      eventType: options.eventType,
      title: options.title,
      body: options.body,
      data: options.data,
      status: 'suppressed',
      createdAt: new Date().toISOString(),
    };
    notificationHistoryStore.unshift(suppressedRecord);
    return { sentCount: 0, suppressed: true, notifications: [suppressedRecord] };
  }

  // Determine recipients
  let recipientUserIds: string[] = [];
  if (options.targetUserId) {
    recipientUserIds = [options.targetUserId];
  } else {
    // All active members in the room except the author who performed the action
    const members = Array.from(membersStore.values()).filter(
      (m) => m.roomId === options.roomId && m.status === 'active'
    );
    recipientUserIds = members
      .map((m) => m.userId)
      .filter((uid) => !options.senderUserId || uid !== options.senderUserId);
  }

  const createdRecords: NotificationRecord[] = [];
  let sentCount = 0;

  for (const recipientId of recipientUserIds) {
    const token = userPushTokensStore.get(recipientId);
    const notifId = crypto.randomUUID();
    const now = new Date().toISOString();

    let delivered = true;
    if (token) {
      delivered = await sendExpoPushNotification({
        to: token,
        title: options.title,
        body: options.body,
        data: options.data,
      });
    }

    const record: NotificationRecord = {
      id: notifId,
      roomId: options.roomId,
      recipientUserId: recipientId,
      senderUserId: options.senderUserId,
      eventType: options.eventType,
      title: options.title,
      body: options.body,
      data: options.data,
      pushToken: token,
      status: delivered ? 'delivered' : 'sent',
      createdAt: now,
    };

    notificationHistoryStore.unshift(record);
    createdRecords.push(record);
    sentCount++;
  }

  return { sentCount, suppressed: false, notifications: createdRecords };
}

// -------------------------------------------------------------
// Dedicated Handlers for the 7 PRD Event Types
// -------------------------------------------------------------

/**
 * Event 1: New expense added
 */
export async function notifyExpenseCreated(
  roomId: string,
  expense: { id: string; name: string; amountPaise: number },
  sender: { id: string; name: string }
) {
  return sendRoomNotification({
    roomId,
    senderUserId: sender.id,
    eventType: 'expense_created',
    title: 'New Expense Added',
    body: `${sender.name} added ${expense.name}: ${formatPaise(expense.amountPaise)}`,
    data: {
      eventType: 'expense_created',
      roomId,
      url: '/(tabs)/expenses',
      expenseId: expense.id,
      amountPaise: expense.amountPaise,
    },
  });
}

/**
 * Event 2: Expense edited
 */
export async function notifyExpenseUpdated(
  roomId: string,
  expense: { id: string; name: string; amountPaise: number },
  updater: { id: string; name: string }
) {
  return sendRoomNotification({
    roomId,
    senderUserId: updater.id,
    eventType: 'expense_updated',
    title: 'Expense Updated',
    body: `${updater.name} updated ${expense.name}: ${formatPaise(expense.amountPaise)}`,
    data: {
      eventType: 'expense_updated',
      roomId,
      url: '/(tabs)/expenses',
      expenseId: expense.id,
      amountPaise: expense.amountPaise,
    },
  });
}

/**
 * Event 3: Expense deleted
 */
export async function notifyExpenseDeleted(
  roomId: string,
  expenseName: string,
  deleter: { id: string; name: string }
) {
  return sendRoomNotification({
    roomId,
    senderUserId: deleter.id,
    eventType: 'expense_deleted',
    title: 'Expense Deleted',
    body: `${deleter.name} removed expense: ${expenseName}`,
    data: {
      eventType: 'expense_deleted',
      roomId,
      url: '/(tabs)/expenses',
    },
  });
}

/**
 * Event 4: Settlement finalized
 */
export async function notifySettlementFinalized(
  roomId: string,
  settlement: { period: string; grandTotalPaise: number },
  finalizer: { id: string; name: string }
) {
  return sendRoomNotification({
    roomId,
    senderUserId: finalizer.id,
    eventType: 'settlement_finalized',
    title: 'Settlement Finalized 🔒',
    body: `${settlement.period} settlement locked (${formatPaise(settlement.grandTotalPaise)} total). Check your share.`,
    data: {
      eventType: 'settlement_finalized',
      roomId,
      url: `/statement-detail?period=${settlement.period}`,
      period: settlement.period,
    },
  });
}

/**
 * Event 5: Payment marked as sent
 */
export async function notifyPaymentSent(
  roomId: string,
  payment: { id: string; amountPaise: number; collectorUserId?: string },
  sender: { id: string; name: string }
) {
  return sendRoomNotification({
    roomId,
    senderUserId: sender.id,
    targetUserId: payment.collectorUserId,
    eventType: 'payment_sent',
    title: 'Payment Received — Awaiting Confirmation',
    body: `${sender.name} sent payment of ${formatPaise(payment.amountPaise)}. Please confirm.`,
    data: {
      eventType: 'payment_sent',
      roomId,
      url: '/collector-confirmations',
      paymentId: payment.id,
      amountPaise: payment.amountPaise,
    },
  });
}

/**
 * Event 6: Payment confirmed
 */
export async function notifyPaymentConfirmed(
  roomId: string,
  payment: { id: string; amountPaise: number; payerUserId: string },
  collector: { id: string; name: string }
) {
  return sendRoomNotification({
    roomId,
    senderUserId: collector.id,
    targetUserId: payment.payerUserId,
    eventType: 'payment_confirmed',
    title: 'Payment Confirmed! 🎉',
    body: `${collector.name} confirmed your payment of ${formatPaise(payment.amountPaise)}.`,
    data: {
      eventType: 'payment_confirmed',
      roomId,
      url: '/payment-history',
      paymentId: payment.id,
      amountPaise: payment.amountPaise,
    },
  });
}

/**
 * Event 7: Payment confirmation reversed
 */
export async function notifyPaymentReversed(
  roomId: string,
  payment: { id: string; amountPaise: number; payerUserId: string },
  collector: { id: string; name: string },
  reason: string
) {
  return sendRoomNotification({
    roomId,
    senderUserId: collector.id,
    targetUserId: payment.payerUserId,
    eventType: 'payment_reversed',
    title: 'Payment Reversed ⚠️',
    body: `Payment of ${formatPaise(payment.amountPaise)} was reversed: "${reason}"`,
    data: {
      eventType: 'payment_reversed',
      roomId,
      url: '/payment-history',
      paymentId: payment.id,
      amountPaise: payment.amountPaise,
      reason,
    },
  });
}

/**
 * Bonus: Water delivery logged
 */
export async function notifyWaterDeliveryLogged(
  roomId: string,
  delivery: { id: string; pricePaise: number },
  sender: { id: string; name: string }
) {
  return sendRoomNotification({
    roomId,
    senderUserId: sender.id,
    eventType: 'water_delivery_logged',
    title: 'Water Can Delivered 💧',
    body: `${sender.name} logged 1 water can delivery (${formatPaise(delivery.pricePaise)}).`,
    data: {
      eventType: 'water_delivery_logged',
      roomId,
      url: '/water-delivery',
      deliveryId: delivery.id,
    },
  });
}
