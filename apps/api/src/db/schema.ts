import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  bigint,
  date,
  timestamp,
  pgEnum,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// -------------------------------------------------------------
// ENUMS
// -------------------------------------------------------------

export const roomStatusEnum = pgEnum('room_status', ['active', 'closed']);
export const roomRoleEnum = pgEnum('room_role', ['admin', 'member']);
export const memberStatusEnum = pgEnum('member_status', ['pending', 'active', 'departed']);
export const settlementPrefEnum = pgEnum('settlement_preference', ['monthly', 'immediate']);
export const settlementStatusEnum = pgEnum('settlement_status', ['draft', 'finalized']);
export const paymentMethodEnum = pgEnum('payment_method', ['upi', 'cash']);
export const paymentStatusEnum = pgEnum('payment_status', ['sent', 'confirmed', 'cancelled', 'reversed']);
export const serviceTypeEnum = pgEnum('service_type', ['water', 'cleaner']);
export const invitationStatusEnum = pgEnum('invitation_status', ['pending', 'used', 'expired']);

// -------------------------------------------------------------
// 1. USERS
// -------------------------------------------------------------
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  avatarUrl: text('avatar_url'),
  pushToken: text('push_token'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// -------------------------------------------------------------
// 2. ROOMS
// -------------------------------------------------------------
export const rooms = pgTable(
  'rooms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull(),
    adminId: uuid('admin_id').notNull().references(() => users.id),
    collectorId: uuid('collector_id').references(() => users.id),
    monthlyRentPaise: bigint('monthly_rent_paise', { mode: 'number' }).notNull(),
    settlementDay: integer('settlement_day').default(28).notNull(),
    notificationsEnabled: boolean('notifications_enabled').default(true).notNull(),
    status: roomStatusEnum('status').default('active').notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('rooms_admin_idx').on(table.adminId),
    index('rooms_collector_idx').on(table.collectorId),
    index('rooms_status_idx').on(table.status),
  ]
);

// -------------------------------------------------------------
// 3. ROOM MEMBERS
// -------------------------------------------------------------
export const roomMembers = pgTable(
  'room_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id').notNull().references(() => rooms.id),
    userId: uuid('user_id').notNull().references(() => users.id),
    role: roomRoleEnum('role').default('member').notNull(),
    status: memberStatusEnum('status').default('pending').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }),
    departedAt: timestamp('departed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('room_members_room_idx').on(table.roomId, table.status),
    index('room_members_user_idx').on(table.userId, table.status),
  ]
);

// -------------------------------------------------------------
// 4. ROOM CATEGORIES
// -------------------------------------------------------------
export const roomCategories = pgTable(
  'room_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id').notNull().references(() => rooms.id),
    name: varchar('name', { length: 50 }).notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('room_categories_room_idx').on(table.roomId, table.isActive),
  ]
);

// -------------------------------------------------------------
// 5. EXPENSES
// -------------------------------------------------------------
export const expenses = pgTable(
  'expenses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id').notNull().references(() => rooms.id),
    name: varchar('name', { length: 200 }).notNull(),
    amountPaise: bigint('amount_paise', { mode: 'number' }).notNull(),
    categoryId: uuid('category_id').notNull().references(() => roomCategories.id),
    paidByUserId: uuid('paid_by_user_id').notNull().references(() => users.id),
    expenseDate: date('expense_date').notNull(),
    expensePeriod: varchar('expense_period', { length: 7 }).notNull(), // YYYY-MM
    settlementPeriod: varchar('settlement_period', { length: 7 }),   // YYYY-MM
    billingPeriodStart: date('billing_period_start'),
    billingPeriodEnd: date('billing_period_end'),
    settlementPreference: settlementPrefEnum('settlement_preference').default('monthly').notNull(),
    settlementId: uuid('settlement_id'), // resolved later
    createdByUserId: uuid('created_by_user_id').notNull().references(() => users.id),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('expenses_room_period_idx').on(table.roomId, table.expensePeriod),
    index('expenses_settlement_period_idx').on(table.roomId, table.settlementPeriod),
    index('expenses_deleted_idx').on(table.roomId, table.deletedAt),
  ]
);

// -------------------------------------------------------------
// 6. EXPENSE SHARES
// -------------------------------------------------------------
export const expenseShares = pgTable(
  'expense_shares',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    expenseId: uuid('expense_id').notNull().references(() => expenses.id),
    userId: uuid('user_id').notNull().references(() => users.id),
    sharePaise: bigint('share_paise', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('expense_shares_expense_idx').on(table.expenseId),
    index('expense_shares_user_idx').on(table.userId),
  ]
);

// -------------------------------------------------------------
// 7. SETTLEMENTS
// -------------------------------------------------------------
export const settlements = pgTable(
  'settlements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id').notNull().references(() => rooms.id),
    period: varchar('period', { length: 7 }).notNull(), // YYYY-MM
    status: settlementStatusEnum('status').default('draft').notNull(),
    finalizedByUserId: uuid('finalized_by_user_id').references(() => users.id),
    finalizedAt: timestamp('finalized_at', { withTimezone: true }),
    totalRentPaise: bigint('total_rent_paise', { mode: 'number' }).default(0).notNull(),
    totalExpensesPaise: bigint('total_expenses_paise', { mode: 'number' }).default(0).notNull(),
    totalCarriedForwardPaise: bigint('total_carried_forward_paise', { mode: 'number' }).default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('settlements_room_period_unique').on(table.roomId, table.period),
  ]
);

// -------------------------------------------------------------
// 8. SETTLEMENT MEMBER SHARES
// -------------------------------------------------------------
export const settlementMemberShares = pgTable(
  'settlement_member_shares',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    settlementId: uuid('settlement_id').notNull().references(() => settlements.id),
    userId: uuid('user_id').notNull().references(() => users.id),
    rentSharePaise: bigint('rent_share_paise', { mode: 'number' }).default(0).notNull(),
    expenseSharePaise: bigint('expense_share_paise', { mode: 'number' }).default(0).notNull(),
    carriedForwardPaise: bigint('carried_forward_paise', { mode: 'number' }).default(0).notNull(),
    totalSharePaise: bigint('total_share_paise', { mode: 'number' }).default(0).notNull(),
    amountPaidPaise: bigint('amount_paid_paise', { mode: 'number' }).default(0).notNull(),
    amountOwedPaise: bigint('amount_owed_paise', { mode: 'number' }).default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('settlement_shares_settlement_user_unique').on(table.settlementId, table.userId),
  ]
);

// -------------------------------------------------------------
// 9. PAYMENTS
// -------------------------------------------------------------
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id').notNull().references(() => rooms.id),
    settlementId: uuid('settlement_id').notNull().references(() => settlements.id),
    payerUserId: uuid('payer_user_id').notNull().references(() => users.id),
    collectorUserId: uuid('collector_user_id').notNull().references(() => users.id),
    amountPaise: bigint('amount_paise', { mode: 'number' }).notNull(),
    method: paymentMethodEnum('method').notNull(),
    status: paymentStatusEnum('status').default('sent').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow().notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    reversedAt: timestamp('reversed_at', { withTimezone: true }),
    reversalReason: text('reversal_reason'),
    idempotencyKey: uuid('idempotency_key').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('payments_room_settlement_idx').on(table.roomId, table.settlementId),
    index('payments_payer_idx').on(table.payerUserId),
    index('payments_status_idx').on(table.status),
  ]
);

// -------------------------------------------------------------
// 10. LANDLORD PAYMENTS
// -------------------------------------------------------------
export const landlordPayments = pgTable(
  'landlord_payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id').notNull().references(() => rooms.id),
    settlementId: uuid('settlement_id').notNull().references(() => settlements.id),
    paidByUserId: uuid('paid_by_user_id').notNull().references(() => users.id),
    amountPaise: bigint('amount_paise', { mode: 'number' }).notNull(),
    method: paymentMethodEnum('method').notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('landlord_payments_room_idx').on(table.roomId, table.settlementId),
  ]
);

// -------------------------------------------------------------
// 11. WATER DELIVERIES
// -------------------------------------------------------------
export const waterDeliveries = pgTable(
  'water_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id').notNull().references(() => rooms.id),
    deliveryDate: date('delivery_date').notNull(),
    deliveryTime: varchar('delivery_time', { length: 10 }).notNull(), // HH:mm
    pricePaise: bigint('price_paise', { mode: 'number' }).notNull(),
    recordedByUserId: uuid('recorded_by_user_id').notNull().references(() => users.id),
    expensePeriod: varchar('expense_period', { length: 7 }).notNull(), // YYYY-MM
    idempotencyKey: uuid('idempotency_key').notNull().unique(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('water_deliveries_room_period_idx').on(table.roomId, table.expensePeriod),
    index('water_deliveries_date_idx').on(table.roomId, table.deliveryDate),
  ]
);

// -------------------------------------------------------------
// 12. SERVICE CONFIGS (Water, Cleaner)
// -------------------------------------------------------------
export const serviceConfigs = pgTable(
  'service_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id').notNull().references(() => rooms.id),
    serviceType: serviceTypeEnum('service_type').notNull(),
    pricePaise: bigint('price_paise', { mode: 'number' }).notNull(),
    effectiveFrom: date('effective_from').notNull(),
    setByUserId: uuid('set_by_user_id').notNull().references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('service_configs_room_type_idx').on(table.roomId, table.serviceType, table.effectiveFrom),
  ]
);

// -------------------------------------------------------------
// 13. ROOM INVITATIONS
// -------------------------------------------------------------
export const roomInvitations = pgTable(
  'room_invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id').notNull().references(() => rooms.id),
    token: varchar('token', { length: 64 }).notNull().unique(),
    createdByUserId: uuid('created_by_user_id').notNull().references(() => users.id),
    usedByUserId: uuid('used_by_user_id').references(() => users.id),
    status: invitationStatusEnum('status').default('pending').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('room_invitations_token_idx').on(table.token),
    index('room_invitations_room_idx').on(table.roomId, table.status),
  ]
);

// -------------------------------------------------------------
// 14. ACTIVITY LOG (Append-only audit)
// -------------------------------------------------------------
export const activityLog = pgTable(
  'activity_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id').notNull().references(() => rooms.id),
    userId: uuid('user_id').notNull().references(() => users.id),
    action: varchar('action', { length: 50 }).notNull(),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: uuid('entity_id'),
    details: jsonb('details'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('activity_log_room_idx').on(table.roomId, table.createdAt),
    index('activity_log_entity_idx').on(table.entityType, table.entityId),
  ]
);

// -------------------------------------------------------------
// DRIZZLE RELATIONS
// -------------------------------------------------------------
export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(roomMembers),
  expensesPaid: many(expenses),
  activityLogs: many(activityLog),
}));

export const roomsRelations = relations(rooms, ({ one, many }) => ({
  admin: one(users, { fields: [rooms.adminId], references: [users.id] }),
  collector: one(users, { fields: [rooms.collectorId], references: [users.id] }),
  members: many(roomMembers),
  categories: many(roomCategories),
  expenses: many(expenses),
  settlements: many(settlements),
  activityLogs: many(activityLog),
}));

export const roomMembersRelations = relations(roomMembers, ({ one }) => ({
  room: one(rooms, { fields: [roomMembers.roomId], references: [rooms.id] }),
  user: one(users, { fields: [roomMembers.userId], references: [users.id] }),
}));

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  room: one(rooms, { fields: [expenses.roomId], references: [rooms.id] }),
  category: one(roomCategories, { fields: [expenses.categoryId], references: [roomCategories.id] }),
  paidBy: one(users, { fields: [expenses.paidByUserId], references: [users.id] }),
  createdBy: one(users, { fields: [expenses.createdByUserId], references: [users.id] }),
  shares: many(expenseShares),
}));

export const expenseSharesRelations = relations(expenseShares, ({ one }) => ({
  expense: one(expenses, { fields: [expenseShares.expenseId], references: [expenses.id] }),
  user: one(users, { fields: [expenseShares.userId], references: [users.id] }),
}));

export const settlementsRelations = relations(settlements, ({ one, many }) => ({
  room: one(rooms, { fields: [settlements.roomId], references: [rooms.id] }),
  finalizedBy: one(users, { fields: [settlements.finalizedByUserId], references: [users.id] }),
  memberShares: many(settlementMemberShares),
  payments: many(payments),
}));
