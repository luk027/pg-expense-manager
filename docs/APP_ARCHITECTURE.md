# PG Expense Manager — Application Architecture

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Mobile App (Expo)                      │
│  React Native + Expo Router + TanStack Query + NativeWind │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │   Home   │ │ Calendar │ │ Expenses │ │ Settlement │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘  │
│  ┌──────────┐                                            │
│  │   Room   │                                            │
│  └──────────┘                                            │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS (Hono RPC)
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Cloudflare Workers (API)                     │
│  Hono v4 + Zod + Better Auth + Expo Push                 │
│  ┌────────┐ ┌──────────┐ ┌───────────┐ ┌─────────────┐ │
│  │  Auth  │ │  Rooms   │ │ Expenses  │ │ Settlements │ │
│  └────────┘ └──────────┘ └───────────┘ └─────────────┘ │
│  ┌────────────┐ ┌───────────┐ ┌──────────────────────┐  │
│  │  Payments  │ │ Services  │ │ Notifications/Cron   │  │
│  └────────────┘ └───────────┘ └──────────────────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │ TCP via Hyperdrive
                       ▼
┌─────────────────────────────────────────────────────────┐
│                 Neon PostgreSQL                           │
│  Drizzle ORM + drizzle-kit migrations                    │
│  ┌────────┐ ┌────────┐ ┌────────────┐ ┌──────────────┐ │
│  │ Users  │ │ Rooms  │ │  Expenses  │ │ Settlements  │ │
│  └────────┘ └────────┘ └────────────┘ └──────────────┘ │
│  ┌────────────┐ ┌───────────┐ ┌──────────────────────┐  │
│  │  Payments  │ │ Services  │ │  Activity Log        │  │
│  └────────────┘ └───────────┘ └──────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## 2. Monorepo Structure

```
pg-expense-manager/
├── apps/
│   ├── mobile/                 # Expo React Native app
│   │   ├── app/                # Expo Router file-based routes
│   │   │   ├── (tabs)/         # Tab navigation group
│   │   │   │   ├── index.tsx           # Home
│   │   │   │   ├── calendar.tsx        # Calendar
│   │   │   │   ├── expenses.tsx        # Expenses
│   │   │   │   ├── settlement.tsx      # Settlement
│   │   │   │   └── room.tsx            # Room
│   │   │   ├── (auth)/         # Auth screens
│   │   │   │   ├── login.tsx
│   │   │   │   └── register.tsx
│   │   │   ├── (modals)/       # Modal screens
│   │   │   │   ├── add-expense.tsx
│   │   │   │   ├── payment.tsx
│   │   │   │   └── water-delivery.tsx
│   │   │   └── _layout.tsx     # Root layout
│   │   ├── components/         # Shared UI components
│   │   │   ├── ui/             # Base: Card, Button, Badge, Amount
│   │   │   ├── forms/          # Form components
│   │   │   └── screens/        # Screen-specific components
│   │   ├── hooks/              # Custom React hooks
│   │   ├── lib/                # Utilities, API client, tokens
│   │   ├── stores/             # Local state (if needed)
│   │   └── assets/             # Images, fonts
│   │
│   └── api/                    # Cloudflare Workers API
│       ├── src/
│       │   ├── routes/         # Hono route handlers
│       │   │   ├── auth.ts
│       │   │   ├── rooms.ts
│       │   │   ├── expenses.ts
│       │   │   ├── settlements.ts
│       │   │   ├── payments.ts
│       │   │   ├── services.ts
│       │   │   └── notifications.ts
│       │   ├── middleware/      # Auth, validation, error handling
│       │   ├── services/       # Business logic layer
│       │   │   ├── settlement-engine.ts  # Core settlement logic
│       │   │   ├── expense-service.ts
│       │   │   ├── payment-service.ts
│       │   │   └── notification-service.ts
│       │   ├── db/             # Database layer
│       │   │   ├── schema.ts   # Drizzle schema
│       │   │   ├── migrations/ # drizzle-kit migrations
│       │   │   └── index.ts    # DB connection
│       │   └── index.ts        # Hono app entry point
│       ├── wrangler.toml       # Workers config
│       └── vitest.config.ts
│
├── packages/
│   └── shared/                 # @pg/shared
│       ├── src/
│       │   ├── schemas/        # Zod schemas (validation)
│       │   ├── types/          # TypeScript types
│       │   ├── constants/      # Shared constants
│       │   └── utils/          # Shared utilities (money formatting, etc.)
│       └── package.json
│
├── docs/                       # Project documentation
├── turbo.json                  # Turborepo config
├── pnpm-workspace.yaml         # pnpm workspace config
├── package.json                # Root package.json
└── tsconfig.base.json          # Shared TypeScript config
```

## 3. Data Flow

### Adding an Expense
1. User fills the add-expense form (validated by Zod schema from `@pg/shared`).
2. TanStack Query mutation sends the request via Hono RPC client.
3. Workers API validates input (same Zod schema), checks permissions.
4. Within a **database transaction**: expense is inserted, shares calculated, activity log entry created.
5. Push notification sent to all roommates.
6. Optimistic update on client; refetch on confirmation.

### Monthly Settlement Flow
1. Settlement engine calculates: current rent + previous month expenses + carried-forward items.
2. Each roommate's share computed (integer paise, deterministic rounding).
3. Roommate reviews and finalizes settlement.
4. Payment workflow: mark sent → collector confirms → recorded.
5. Landlord payment tracked separately.

### Water Delivery Recording
1. Roommate taps "Water Delivery" (optimistic update with undo).
2. Server records with idempotency key to prevent duplicates.
3. All roommates see the delivery in real-time (via refetch + push notification).

## 4. Authentication Flow

1. User registers/logs in via Better Auth (email + password for v1).
2. Session token stored securely on device.
3. All API calls include the session token.
4. Better Auth Expo plugin handles native vs. web session differences.

## 5. Key Design Patterns

- **Service Layer** — Business logic lives in `services/`, not in route handlers.
- **Repository Pattern** — Database queries abstracted behind typed functions.
- **Transaction Boundaries** — All multi-step operations use interactive Postgres transactions.
- **Soft Deletes** — `deleted_at` column; queries filter by default.
- **Append-Only Audit** — The `activity_log` table is insert-only; entries are never modified or deleted.
- **Optimistic Updates** — TanStack Query mutations update UI immediately; rollback on error.
- **Idempotency** — Water delivery and payment operations use idempotency keys.
