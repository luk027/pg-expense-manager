import { Hono } from 'hono';
import { z } from 'zod';
import crypto from 'crypto';
import { authMiddleware } from '../middleware/auth';
import { AuthUser } from './auth';
import { roomsStore, membersStore, logActivity } from './rooms';
import { notifyWaterDeliveryLogged } from '../services/notification-service';

export interface ServiceConfigRecord {
  id: string;
  roomId: string;
  serviceType: 'water' | 'cleaner';
  pricePaise: number;
  effectiveFrom: string; // YYYY-MM-DD
  setByUserId: string;
  setByName: string;
  createdAt: string;
}

export interface WaterDeliveryRecord {
  id: string;
  roomId: string;
  deliveryDate: string; // YYYY-MM-DD
  deliveryTime: string; // HH:MM or HH:MM:SS
  pricePaise: number;
  recordedByUserId: string;
  recordedByName: string;
  expensePeriod: string; // YYYY-MM
  idempotencyKey: string;
  deletedAt: string | null;
  createdAt: string;
}

// In-memory data stores
export const serviceConfigsStore = new Map<string, ServiceConfigRecord>();
export const waterDeliveriesStore = new Map<string, WaterDeliveryRecord>();
const waterIdempotencyKeyMap = new Map<string, string>(); // idempotencyKey -> deliveryId

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

// Helper to get active service price as of a given date (default today)
export function getActiveServicePrice(roomId: string, serviceType: 'water' | 'cleaner', asOfDate?: string): number {
  const targetDate = asOfDate || new Date().toISOString().substring(0, 10);
  const configs = Array.from(serviceConfigsStore.values()).filter(
    (sc) => sc.roomId === roomId && sc.serviceType === serviceType && sc.effectiveFrom <= targetDate
  );

  if (configs.length === 0) {
    // Default prices: Water = ₹40 (4000 paise), Cleaner = ₹3,000 (300000 paise)
    return serviceType === 'water' ? 4000 : 300000;
  }

  // Sort descending by effectiveFrom
  configs.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  return configs[0].pricePaise;
}

// -------------------------------------------------------------
// PRE-SEED FLAT 302 SERVICE CONFIGS & HISTORICAL WATER DELIVERIES
// -------------------------------------------------------------
const DEMO_ROOM_ID = 'r3023023-3023-3023-3023-302330233023';
const RAHUL_ID = 'u1111111-1111-1111-1111-111111111111';
const AMAN_ID = 'u2222222-2222-2222-2222-222222222222';

(() => {
  const now = new Date().toISOString();

  // 1. Initial service configs
  const scWater: ServiceConfigRecord = {
    id: 'sc-flat302-water-default',
    roomId: DEMO_ROOM_ID,
    serviceType: 'water',
    pricePaise: 4000, // ₹40 per water delivery
    effectiveFrom: '2026-10-01',
    setByUserId: RAHUL_ID,
    setByName: 'Rahul Sharma',
    createdAt: now,
  };
  serviceConfigsStore.set(scWater.id, scWater);

  const scCleaner: ServiceConfigRecord = {
    id: 'sc-flat302-cleaner-default',
    roomId: DEMO_ROOM_ID,
    serviceType: 'cleaner',
    pricePaise: 300000, // ₹3,000 monthly cleaner salary
    effectiveFrom: '2026-10-01',
    setByUserId: RAHUL_ID,
    setByName: 'Rahul Sharma',
    createdAt: now,
  };
  serviceConfigsStore.set(scCleaner.id, scCleaner);

  // 2. Pre-seed October 2026 deliveries (15 deliveries)
  const octDates = [
    { date: '2026-10-02', time: '09:00', by: RAHUL_ID, name: 'Rahul Sharma' },
    { date: '2026-10-04', time: '10:15', by: AMAN_ID, name: 'Aman Verma' },
    { date: '2026-10-07', time: '08:45', by: RAHUL_ID, name: 'Rahul Sharma' },
    { date: '2026-10-09', time: '11:00', by: AMAN_ID, name: 'Aman Verma' },
    { date: '2026-10-11', time: '09:30', by: RAHUL_ID, name: 'Rahul Sharma' },
    { date: '2026-10-14', time: '10:00', by: AMAN_ID, name: 'Aman Verma' },
    { date: '2026-10-16', time: '08:30', by: RAHUL_ID, name: 'Rahul Sharma' },
    { date: '2026-10-18', time: '12:00', by: AMAN_ID, name: 'Aman Verma' },
    { date: '2026-10-21', time: '09:15', by: RAHUL_ID, name: 'Rahul Sharma' },
    { date: '2026-10-23', time: '10:30', by: AMAN_ID, name: 'Aman Verma' },
    { date: '2026-10-25', time: '09:00', by: RAHUL_ID, name: 'Rahul Sharma' },
    // Multiple deliveries on same day (Oct 28)
    { date: '2026-10-28', time: '09:30', by: RAHUL_ID, name: 'Rahul Sharma' },
    { date: '2026-10-28', time: '17:00', by: AMAN_ID, name: 'Aman Verma' },
    { date: '2026-10-30', time: '09:00', by: RAHUL_ID, name: 'Rahul Sharma' },
  ];

  octDates.forEach((d, idx) => {
    const id = `wd-oct-${idx + 1}`;
    waterDeliveriesStore.set(id, {
      id,
      roomId: DEMO_ROOM_ID,
      deliveryDate: d.date,
      deliveryTime: d.time,
      pricePaise: 4000,
      recordedByUserId: d.by,
      recordedByName: d.name,
      expensePeriod: '2026-10',
      idempotencyKey: `idem-oct-wd-${idx + 1}`,
      deletedAt: null,
      createdAt: `${d.date}T${d.time}:00.000Z`,
    });
  });

  // 3. Pre-seed November 2026 deliveries (including PRD example on Nov 12!)
  const novDates = [
    { date: '2026-11-02', time: '09:00', by: RAHUL_ID, name: 'Rahul Sharma' },
    { date: '2026-11-05', time: '10:30', by: AMAN_ID, name: 'Aman Verma' },
    { date: '2026-11-08', time: '08:45', by: RAHUL_ID, name: 'Rahul Sharma' },
    { date: '2026-11-11', time: '09:15', by: AMAN_ID, name: 'Aman Verma' },
    // Nov 12 PRD canonical example (two deliveries same day = ₹80)
    { date: '2026-11-12', time: '09:00', by: RAHUL_ID, name: 'Rahul Sharma' },
    { date: '2026-11-12', time: '18:30', by: AMAN_ID, name: 'Aman Verma' },
    // Nov 13 PRD example
    { date: '2026-11-13', time: '10:00', by: RAHUL_ID, name: 'Rahul Sharma' },
    { date: '2026-11-16', time: '09:00', by: AMAN_ID, name: 'Aman Verma' },
    { date: '2026-11-19', time: '11:15', by: RAHUL_ID, name: 'Rahul Sharma' },
  ];

  novDates.forEach((d, idx) => {
    const id = `wd-nov-${idx + 1}`;
    waterDeliveriesStore.set(id, {
      id,
      roomId: DEMO_ROOM_ID,
      deliveryDate: d.date,
      deliveryTime: d.time,
      pricePaise: 4000,
      recordedByUserId: d.by,
      recordedByName: d.name,
      expensePeriod: '2026-11',
      idempotencyKey: `idem-nov-wd-${idx + 1}`,
      deletedAt: null,
      createdAt: `${d.date}T${d.time}:00.000Z`,
    });
  });
})();

// -------------------------------------------------------------
// VALIDATION SCHEMAS
// -------------------------------------------------------------
const updateServiceConfigSchema = z.object({
  serviceType: z.enum(['water', 'cleaner']),
  pricePaise: z.number().int().positive('Price must be a positive integer in paise'),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'effectiveFrom must be YYYY-MM-DD'),
});

const recordWaterDeliverySchema = z.object({
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'deliveryDate must be YYYY-MM-DD').optional(),
  deliveryTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'deliveryTime must be HH:MM').optional(),
  pricePaise: z.number().int().positive().optional(),
  idempotencyKey: z.string().min(1, 'Idempotency key is required'),
});

const bulkWaterDeliverySchema = z.object({
  entries: z.array(
    z.object({
      deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'deliveryDate must be YYYY-MM-DD'),
      deliveryTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'deliveryTime must be HH:MM').optional(),
    })
  ).min(1, 'At least one delivery entry required'),
  idempotencyKey: z.string().min(1, 'Idempotency key is required'),
});

// -------------------------------------------------------------
// HONO ROUTER
// -------------------------------------------------------------
const services = new Hono<{ Variables: { user: AuthUser } }>();

services.use('*', authMiddleware);

// -------------------------------------------------------------
// GET /api/rooms/:roomId/services/configs
// Get active service prices and configuration history
// -------------------------------------------------------------
services.get('/:roomId/services/configs', (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');

  const access = checkRoomAccess(roomId, user.id);
  if (!access.allowed) {
    return c.json({ error: access.error }, 403);
  }

  const allConfigs = Array.from(serviceConfigsStore.values())
    .filter((sc) => sc.roomId === roomId)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));

  const activeWaterPricePaise = getActiveServicePrice(roomId, 'water');
  const activeCleanerPricePaise = getActiveServicePrice(roomId, 'cleaner');

  return c.json({
    activePrices: {
      waterPricePaise: activeWaterPricePaise,
      cleanerPricePaise: activeCleanerPricePaise,
    },
    configs: allConfigs,
  });
});

// -------------------------------------------------------------
// PUT /api/rooms/:roomId/services/configs
// Update service price configuration (Admin only)
// -------------------------------------------------------------
services.put('/:roomId/services/configs', async (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');

  const access = checkRoomAccess(roomId, user.id);
  if (!access.allowed) {
    return c.json({ error: access.error }, 403);
  }

  const room = access.room!;
  if (user.id !== room.adminId) {
    return c.json({ error: 'Forbidden: only the room admin can update service prices' }, 403);
  }

  const body = await c.req.json().catch(() => null);
  const parseResult = updateServiceConfigSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten().fieldErrors }, 400);
  }

  const data = parseResult.data;
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const newConfig: ServiceConfigRecord = {
    id,
    roomId,
    serviceType: data.serviceType,
    pricePaise: data.pricePaise,
    effectiveFrom: data.effectiveFrom,
    setByUserId: user.id,
    setByName: user.name,
    createdAt: now,
  };

  serviceConfigsStore.set(id, newConfig);

  logActivity(roomId, user.id, 'service_price_updated', {
    serviceType: data.serviceType,
    pricePaise: data.pricePaise,
    effectiveFrom: data.effectiveFrom,
    updatedBy: user.name,
  });

  return c.json({ success: true, config: newConfig });
});

// -------------------------------------------------------------
// GET /api/rooms/:roomId/water-deliveries
// List water deliveries for a given month or date
// -------------------------------------------------------------
services.get('/:roomId/water-deliveries', (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');
  const period = c.req.query('period'); // YYYY-MM
  const date = c.req.query('date');     // YYYY-MM-DD

  const access = checkRoomAccess(roomId, user.id);
  if (!access.allowed) {
    return c.json({ error: access.error }, 403);
  }

  let list = Array.from(waterDeliveriesStore.values()).filter(
    (wd) => wd.roomId === roomId && wd.deletedAt === null
  );

  if (period) {
    list = list.filter((wd) => wd.expensePeriod === period);
  }

  if (date) {
    list = list.filter((wd) => wd.deliveryDate === date);
  }

  // Sort descending by deliveryDate and deliveryTime
  list.sort((a, b) => {
    const dDiff = b.deliveryDate.localeCompare(a.deliveryDate);
    if (dDiff !== 0) return dDiff;
    return b.deliveryTime.localeCompare(a.deliveryTime);
  });

  const totalDeliveriesPricePaise = list.reduce((sum, item) => sum + item.pricePaise, 0);
  const activeWaterPricePaise = getActiveServicePrice(roomId, 'water');

  return c.json({
    deliveries: list,
    count: list.length,
    totalDeliveriesPricePaise,
    activeWaterPricePaise,
  });
});

// -------------------------------------------------------------
// POST /api/rooms/:roomId/water-deliveries
// Record water delivery (Quick-tap or backdated)
// Validates: deliveryDate <= today IST (no future dates)
// -------------------------------------------------------------
services.post('/:roomId/water-deliveries', async (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');

  const access = checkRoomAccess(roomId, user.id);
  if (!access.allowed) {
    return c.json({ error: access.error }, 403);
  }

  const body = await c.req.json().catch(() => null);
  const parseResult = recordWaterDeliverySchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten().fieldErrors }, 400);
  }

  const data = parseResult.data;

  // Idempotency check
  if (waterIdempotencyKeyMap.has(data.idempotencyKey)) {
    const existingId = waterIdempotencyKeyMap.get(data.idempotencyKey)!;
    const existingDelivery = waterDeliveriesStore.get(existingId);
    if (existingDelivery && existingDelivery.deletedAt === null) {
      return c.json({ success: true, delivery: existingDelivery, idempotent: true }, 200);
    }
  }

  // Current time in IST (UTC + 5:30)
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDateObj = new Date(now.getTime() + istOffsetMs);
  const currentISTDate = istDateObj.toISOString().substring(0, 10);
  const currentISTTime = istDateObj.toISOString().substring(11, 16);

  const deliveryDate = data.deliveryDate || currentISTDate;
  const deliveryTime = data.deliveryTime || currentISTTime;

  // RULE: Future delivery entries are not allowed
  if (deliveryDate > currentISTDate) {
    return c.json({ error: 'Future delivery dates are not allowed' }, 400);
  }

  const expensePeriod = deliveryDate.substring(0, 7);
  const pricePaise = data.pricePaise || getActiveServicePrice(roomId, 'water', deliveryDate);
  const id = crypto.randomUUID();

  const newDelivery: WaterDeliveryRecord = {
    id,
    roomId,
    deliveryDate,
    deliveryTime,
    pricePaise,
    recordedByUserId: user.id,
    recordedByName: user.name,
    expensePeriod,
    idempotencyKey: data.idempotencyKey,
    deletedAt: null,
    createdAt: now.toISOString(),
  };

  waterDeliveriesStore.set(id, newDelivery);
  waterIdempotencyKeyMap.set(data.idempotencyKey, id);

  logActivity(roomId, user.id, 'water_delivery_recorded', {
    deliveryId: id,
    deliveryDate,
    deliveryTime,
    pricePaise,
    recordedBy: user.name,
  });

  // Broadcast push notification
  notifyWaterDeliveryLogged(roomId, newDelivery, user);

  return c.json({ success: true, delivery: newDelivery }, 201);
});

// -------------------------------------------------------------
// POST /api/rooms/:roomId/water-deliveries/bulk
// Record multiple backdated deliveries in one operation
// -------------------------------------------------------------
services.post('/:roomId/water-deliveries/bulk', async (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');

  const access = checkRoomAccess(roomId, user.id);
  if (!access.allowed) {
    return c.json({ error: access.error }, 403);
  }

  const body = await c.req.json().catch(() => null);
  const parseResult = bulkWaterDeliverySchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten().fieldErrors }, 400);
  }

  const data = parseResult.data;
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const currentISTDate = new Date(now.getTime() + istOffsetMs).toISOString().substring(0, 10);

  // Validate no future dates
  for (const entry of data.entries) {
    if (entry.deliveryDate > currentISTDate) {
      return c.json({ error: `Future delivery date '${entry.deliveryDate}' is not allowed` }, 400);
    }
  }

  const createdDeliveries: WaterDeliveryRecord[] = [];

  for (let i = 0; i < data.entries.length; i++) {
    const entry = data.entries[i];
    const id = crypto.randomUUID();
    const deliveryTime = entry.deliveryTime || '10:00';
    const pricePaise = getActiveServicePrice(roomId, 'water', entry.deliveryDate);
    const itemKey = `${data.idempotencyKey}-${i}`;

    const newDelivery: WaterDeliveryRecord = {
      id,
      roomId,
      deliveryDate: entry.deliveryDate,
      deliveryTime,
      pricePaise,
      recordedByUserId: user.id,
      recordedByName: user.name,
      expensePeriod: entry.deliveryDate.substring(0, 7),
      idempotencyKey: itemKey,
      deletedAt: null,
      createdAt: now.toISOString(),
    };

    waterDeliveriesStore.set(id, newDelivery);
    createdDeliveries.push(newDelivery);
  }

  logActivity(roomId, user.id, 'water_deliveries_bulk_recorded', {
    count: createdDeliveries.length,
    recordedBy: user.name,
  });

  return c.json({ success: true, count: createdDeliveries.length, deliveries: createdDeliveries }, 201);
});

// -------------------------------------------------------------
// DELETE /api/rooms/:roomId/water-deliveries/:deliveryId
// Soft delete / undo a water delivery entry
// -------------------------------------------------------------
services.delete('/:roomId/water-deliveries/:deliveryId', (c) => {
  const user = c.get('user');
  const roomId = c.req.param('roomId');
  const deliveryId = c.req.param('deliveryId');

  const access = checkRoomAccess(roomId, user.id);
  if (!access.allowed) {
    return c.json({ error: access.error }, 403);
  }

  const delivery = waterDeliveriesStore.get(deliveryId);
  if (!delivery || delivery.roomId !== roomId || delivery.deletedAt !== null) {
    return c.json({ error: 'Water delivery record not found' }, 404);
  }

  delivery.deletedAt = new Date().toISOString();

  logActivity(roomId, user.id, 'water_delivery_deleted', {
    deliveryId,
    deliveryDate: delivery.deliveryDate,
    deletedBy: user.name,
  });

  return c.json({ success: true, message: 'Water delivery removed' });
});

export default services;
