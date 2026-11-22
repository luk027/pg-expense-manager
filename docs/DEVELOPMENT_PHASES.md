# PG Expense Manager — Development Phases

## Overview

The project is divided into **22 phases** (0–21), each independently testable with clear completion criteria. No phase begins without explicit approval of the previous phase.

---

## Phase 0: Project Planning & Documentation
**Status:** ⏳ AWAITING APPROVAL

**Objectives:**
- Analyze complete application requirements from PRD and supporting documents
- Resolve open design decisions raised in PRD feedback
- Select and document technology stack
- Design application architecture and database schema
- Create UI/UX design system documentation
- Plan development phases with clear scope and deliverables

**Deliverables:**
- Complete `/docs` directory with 11+ documentation files
- Resolved design decisions (money flow, finalization edits, settlement timing, etc.)
- Approved development roadmap

**Completion Criteria:**
- All documentation created and reviewed ✅
- Design decisions reviewed by stakeholder
- Development phases approved

---

## Phase 1: Monorepo Setup & Dev Environment

**Objectives:**
- Initialize pnpm + Turborepo monorepo
- Set up `apps/mobile` (Expo with Expo Router), `apps/api` (Hono + Cloudflare Workers), `packages/shared`
- Configure TypeScript (strict), ESLint, Prettier across all packages
- Set up Expo Router with 5-tab navigation skeleton
- Set up Wrangler for local API development with health check endpoint
- Verify dev servers run and QR code works on device

**Files Created:**
- Root: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.eslintrc.js`, `.prettierrc`
- `apps/mobile/`: Expo project with Expo Router, `app.json`, `_layout.tsx`, tab screens (placeholder)
- `apps/api/`: Hono project, `wrangler.toml`, `src/index.ts` with health check
- `packages/shared/`: Package setup with `package.json`, `tsconfig.json`, `src/index.ts`

**Testing:**
- `pnpm install` succeeds without errors
- `pnpm dev` starts both mobile and API dev servers concurrently
- QR code scan opens the app showing 5-tab navigation skeleton
- API health check at `GET /api/health` returns `{ status: "ok" }`
- TypeScript compiles without errors
- ESLint + Prettier run without errors

**Dependencies:** Phase 0 approved

---

## Phase 2: Database Schema & Migrations

**Objectives:**
- Provision Neon database (or use local Postgres for dev)
- Define complete Drizzle ORM schema matching DATABASE_DESIGN.md
- Generate and run initial migration
- Set up Hyperdrive configuration in wrangler.toml
- Create seed script for default categories
- Set up database connection utility

**Files Created/Modified:**
- `apps/api/src/db/schema.ts` — Full Drizzle schema (14 tables)
- `apps/api/src/db/index.ts` — Connection setup (Hyperdrive + fallback)
- `apps/api/src/db/migrations/` — Initial migration files
- `apps/api/src/db/seed.ts` — Default categories seed
- `apps/api/wrangler.toml` — Hyperdrive binding
- `apps/api/drizzle.config.ts` — Drizzle Kit config

**Testing:**
- Migration runs successfully on Neon (or local PG)
- All 14 tables created with correct columns, types, and constraints
- Seed script inserts default categories
- API can query the database via Hyperdrive locally
- Schema types are exported and usable in route handlers

**Dependencies:** Phase 1 approved, Neon database provisioned

---

## Phase 3: Authentication (Backend + Frontend)

**Objectives:**
- Integrate Better Auth on the API (email + password provider)
- Create auth middleware for protected routes
- Build Login and Register screens in the mobile app
- Implement session management with Better Auth Expo plugin
- Auth context provider + `useAuth()` hook
- Route protection (redirect to login if unauthenticated)

**Screens:**
- Login screen (email, password, "Don't have an account?" link)
- Register screen (name, email, password, "Already have an account?" link)

**API Endpoints:**
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/session

**Testing:**
- Register a new user → success, session created
- Register with existing email → error shown
- Login with valid credentials → success, navigates to home
- Login with invalid credentials → error message shown
- Session persists after app restart (auto-login)
- Logout clears session, redirects to login
- Protected API routes return 401 without session
- Forms show validation errors for empty/invalid fields

**Dependencies:** Phase 2 approved

---

## Phase 4: Base UI Component Library

**Objectives:**
- Create `tokens.ts` from the UI Design Guide
- Configure NativeWind v4 with custom theme from tokens
- Build base components: Card, Button, Badge, Amount, Input, Avatar
- Build state components: LoadingSkeleton, EmptyState, ErrorState
- Build StatusPill component for payment/settlement statuses
- Ensure all components work on both iOS and Android
- Build a simple component showcase screen (dev only)

**Files Created:**
- `apps/mobile/lib/tokens.ts`
- `apps/mobile/tailwind.config.js` (NativeWind config)
- `apps/mobile/components/ui/Card.tsx`
- `apps/mobile/components/ui/Button.tsx`
- `apps/mobile/components/ui/Badge.tsx`
- `apps/mobile/components/ui/Amount.tsx`
- `apps/mobile/components/ui/Input.tsx`
- `apps/mobile/components/ui/Avatar.tsx`
- `apps/mobile/components/ui/LoadingSkeleton.tsx`
- `apps/mobile/components/ui/EmptyState.tsx`
- `apps/mobile/components/ui/ErrorState.tsx`
- `apps/mobile/components/ui/StatusPill.tsx`

**Testing:**
- All components render on Android and iOS without errors
- Amount shows ₹1,24,800 format (Indian grouping)
- Button states: default, pressed (opacity change), disabled (muted), loading (spinner)
- Badge/StatusPill colors match semantic meaning (green=settled, red=owed, amber=pending)
- Card has correct shadow on iOS and elevation on Android
- Components look correct on 360dp-wide screen
- Loading skeleton shows shimmer animation
- Empty state shows illustration, message, and action button

**Dependencies:** Phase 3 approved

---

## Phase 5: Room Management (Backend)

**Objectives:**
- Room CRUD service and API routes
- Invitation system (generate token, validate, expire)
- Member management (join request, approve, remove, depart)
- Admin transfer logic
- Collector assignment
- Room-level permission middleware (isAdmin, isMember, isCollector)
- Default categories seeded on room creation
- Activity log entries for room actions

**API Endpoints:**
- POST /api/rooms — Create room
- GET /api/rooms/current — Get user's room
- PATCH /api/rooms/:roomId — Update settings
- POST /api/rooms/:roomId/close — Close room
- POST /api/rooms/:roomId/invite — Generate invite
- POST /api/rooms/:roomId/join — Join via token
- POST /api/rooms/:roomId/members/:memberId/approve — Approve member
- POST /api/rooms/:roomId/members/:memberId/remove — Remove member
- POST /api/rooms/:roomId/transfer-admin — Transfer admin
- PATCH /api/rooms/:roomId/collector — Assign collector

**Testing:**
- Create room → user is admin + collector + active member, 9 default categories created
- Generate invite → valid token with 7-day expiry
- Join with valid token → pending status created
- Join with expired/invalid token → error
- Approve → member status changes to active, joined_at set
- Remove → member status changes to departed, departed_at set, historical data intact
- Admin transfer → roles swap correctly, activity logged
- Assign collector → collector_id updated
- One-room-per-user constraint → error if user already in a room
- Non-admin cannot access admin-only endpoints → 403

**Dependencies:** Phase 3 approved

---

## Phase 6: Room Management (Frontend)

**Objectives:**
- Onboarding flow after first login (Create Room / Join Room)
- Create Room screen (name, initial rent)
- Join Room screen (enter invite code / deep link handling)
- Room tab: member list with roles and status
- Room settings (admin): rent, collector, notifications toggle
- Invite modal: generate link + share via system share sheet
- Admin transfer confirmation dialog
- Pending approval screen (for joining members)

**Screens:**
- Onboarding: "Create Room" / "Join Room" choice
- Create Room form
- Join Room form (paste invite link)
- Pending Approval screen ("Waiting for admin approval...")
- Room Tab — member list, settings sections
- Room Settings — rent, collector picker, notification toggle
- Invite modal — link display + Share button
- Admin transfer confirmation

**Testing:**
- New user → sees onboarding → creates room → lands on home
- Create room → room name shown, user listed as admin
- Share invite link → link copies / share sheet opens
- Another user joins → appears as "pending" in admin's view
- Admin approves → member appears as "active"
- Admin removes → member disappears from active list
- Change rent → new amount shown
- Assign collector → collector badge appears on that member
- Transfer admin → roles swap in UI
- Non-admin → settings section is hidden or read-only

**Dependencies:** Phase 5 approved, Phase 4 approved

---

## Phase 7: Expense Management (Backend)

**Objectives:**
- Expense CRUD service and API routes
- Equal splitting logic (paise-level, deterministic rounding)
- Expense period assignment (from expense date)
- Multi-month bill support (billing period start/end)
- Soft delete with activity logging
- Edit tracking (previous values stored in activity log)
- Shared Zod schemas for expense validation in `@pg/shared`

**API Endpoints:**
- GET /api/rooms/:roomId/expenses — List with filters
- POST /api/rooms/:roomId/expenses — Create
- PATCH /api/rooms/:roomId/expenses/:expenseId — Edit
- DELETE /api/rooms/:roomId/expenses/:expenseId — Soft delete

**Testing:**
- Add expense → splits equally, shares sum = total (paise exact)
- 3 roommates, ₹1000 → shares: 334 + 333 + 333 = 1000 paise (deterministic)
- Edit → previous values logged, new shares recalculated
- Delete → soft deleted, excluded from totals, in activity log
- Multi-month bill → assigned to last month of period
- Non-room-member → 403
- Invalid data (missing fields, negative amount) → validation errors
- Expense period correctly derived from expense date

**Dependencies:** Phase 5 approved

---

## Phase 8: Expense Management (Frontend)

**Objectives:**
- Expenses tab: list of expenses grouped by date
- Sticky month switcher at top
- Floating Action Button (FAB) to add expense
- Add Expense form (bottom sheet or full screen)
- Edit Expense form
- Delete with confirmation dialog
- Expense detail view
- Category badges on each item
- Empty state, loading skeleton, pull-to-refresh

**Screens:**
- Expenses list (grouped by date, month switcher)
- Add Expense form (name, amount, category picker, paid by picker, date, settlement pref)
- Edit Expense form (pre-filled)
- Expense detail (full info + edit/delete actions)

**Testing:**
- Add expense → appears in list immediately (optimistic)
- Edit → values update in list and detail
- Delete → item disappears, confirmation shown first
- Month switcher → different month's expenses load
- Empty month → empty state shown
- Loading → skeleton shown
- Pull-to-refresh → data refreshes
- Amount formatted as ₹X,XX,XXX
- Category badge shows correct color/label
- Form validation: required fields, positive amount

**Dependencies:** Phase 7 approved, Phase 4 approved

---

## Phase 9: Settlement Engine (Core Logic + Unit Tests)

**Objectives:**
- Build a **pure TypeScript module** for settlement calculation
- No API, no database, no UI — just logic and types
- Input: list of expenses, members, rent, carried-forward items
- Output: settlement statement with per-member shares
- Comprehensive unit tests (this is the riskiest code)

**Files Created:**
- `apps/api/src/services/settlement-engine.ts`
- `apps/api/src/services/settlement-engine.test.ts`

**Unit Tests (Vitest):**
- Equal split: 2, 3, 4, 5, 6, 7, 8 members
- Rounding: sum of shares always equals total (no paise lost)
- Rent split + expense split combined
- Carried-forward from previous settlement
- Missing bills (no estimate, carry forward)
- Multi-month bill (assigned to last month)
- Member joins mid-month (full rent, expenses from join month-end)
- Member departs mid-month (expenses up to departure)
- Post-finalization adjustment (edit creates adjustment line)
- Settle-immediately exclusion from monthly settlement
- Edge: single member, all departed, zero expenses
- Edge: very large amounts (₹10,00,000+)
- Edge: very small amounts (₹1)

**Dependencies:** Phase 7 approved

---

## Phase 10: Settlement Engine (API)

**Objectives:**
- Settlement API endpoints using the engine from Phase 9
- Settlement creation and retrieval
- Finalization workflow with database transaction
- Statement generation
- Activity log integration

**API Endpoints:**
- GET /api/rooms/:roomId/settlements — List
- GET /api/rooms/:roomId/settlements/:period — Detail
- POST /api/rooms/:roomId/settlements/:period/finalize — Finalize
- GET /api/rooms/:roomId/settlements/:period/statement — Full statement

**Testing:**
- Generate settlement for a month → correct calculation
- Finalize → status changes, amounts locked, all members notified
- Retrieve statement → all line items and member shares present
- Carried forward → correct items from previous unfinalised month
- Cannot finalize twice (idempotent)
- Activity log entry created on finalization

**Dependencies:** Phase 9 approved

---

## Phase 11: Settlement (Frontend)

**Objectives:**
- Settlement tab: current month's statement card
- Statement details: rent, expenses, carried forward, your share, paid, remaining
- Collection progress bar (collected vs. total)
- Finalize Settlement button with confirmation
- Month navigation for historical settlements
- Payment history section

**Screens:**
- Settlement overview (statement card + progress bar)
- Settlement detail (line items, member breakdown)
- Finalize confirmation modal
- Historical settlement list

**Testing:**
- Statement amounts match backend calculations
- Progress bar reflects correct percentages
- Finalize → confirmation → status updates → notification
- Navigate to past months → correct historical data
- Empty state for months with no settlement
- Loading skeleton while fetching

**Dependencies:** Phase 10 approved, Phase 4 approved

---

## Phase 12: Payment Management (Backend + Frontend)

**Objectives:**
- Payment API: mark sent, confirm, cancel, reverse
- Landlord payment recording
- Payment UI: mark payment sent, collector confirm, reversal form
- Full payment only validation
- Payment history list
- Activity log for all payment actions

**API Endpoints:**
- POST /api/rooms/:roomId/payments — Mark sent
- POST /api/rooms/:roomId/payments/:paymentId/confirm — Confirm
- POST /api/rooms/:roomId/payments/:paymentId/cancel — Cancel
- POST /api/rooms/:roomId/payments/:paymentId/reverse — Reverse
- POST /api/rooms/:roomId/landlord-payments — Landlord payment

**Screens:**
- Mark Payment Sent (amount auto-filled, UPI/Cash selector)
- Collector: Pending Confirmations list
- Confirm Payment dialog
- Reverse Payment form (reason required)
- Landlord Payment form
- Payment History list

**Testing:**
- Mark sent → status "awaiting confirmation"
- Collector confirms → status "confirmed", balance updates
- Cancel before confirmation → status "cancelled"
- Reverse → reason required, status "reversed", notifications sent
- Landlord payment → tracked separately from roommate payments
- Dashboard shows: total due, collected, pending, paid to landlord
- Partial payment → rejected
- Collector's own payment → auto-confirmed

**Dependencies:** Phase 10 approved

---

## Phase 13: Water Delivery & Services (Backend + Frontend)

**Objectives:**
- Water delivery API with idempotency
- Water delivery UI: quick-tap recording, backdating, multiple per day
- Cleaner service configuration
- Service price management (admin, effective dates)
- Activity log for deliveries and price changes

**Screens:**
- Water Delivery quick-tap (with undo toast)
- Water Delivery list (by date, with times)
- Backdate delivery form (date picker, time picker)
- Service Config screen (admin): water price, cleaner price

**Testing:**
- Tap → delivery recorded optimistically with undo
- Double tap → only one entry (idempotency)
- Backdate → correct date/time, appears in correct position
- Multiple deliveries same day → all shown with times, day total correct
- Future date → blocked
- Price change → new deliveries use new price, old ones unchanged
- Cleaner config → amount reflected in settlement
- Undo within 5 seconds → delivery removed

**Dependencies:** Phase 7 approved

---

## Phase 14: Shared Expense Calendar

**Objectives:**
- Calendar tab with monthly grid
- Category-colored dots on dates with expenses
- Date selection → list of that day's expenses
- Horizontal filter chip row (All, Water, Groceries, etc.)
- Water delivery display with individual times
- Month navigation

**Screens:**
- Calendar grid view
- Date detail: expense list for selected date
- Filter chip row

**Testing:**
- Dots appear on dates that have expenses
- Dot colors match categories
- Tap date → see all expenses for that date
- Filter → only matching category expenses shown
- Water deliveries show time + day total
- Month navigation → correct data loads
- Empty date → "No expenses" message
- Multiple expenses same date → all listed

**Dependencies:** Phase 8 approved, Phase 13 approved

---

## Phase 15: Home Dashboard

**Objectives:**
- Greeting row with room name
- Hero card: "You owe ₹X" / "You get ₹X" with Pay button
- Two-up cards: month's room expenses, rent status
- Roommate payment status list (avatars + status pills)
- Quick action grid: Add Expense, Water Delivery, Payments, Report
- Pull-to-refresh

**Screens:**
- Home tab (complete dashboard)

**Testing:**
- Amounts are accurate (match settlement calculations)
- Hero card shows correct owe/receive amount with correct color
- Quick actions navigate to correct screens
- Payment status pills show correct state per roommate
- Room expenses card shows current month total
- Pull-to-refresh updates all data
- Loading skeleton on first load

**Dependencies:** Phase 11 approved, Phase 12 approved

---

## Phase 16: Notifications (Push)

**Objectives:**
- Expo Push Notifications setup
- Push token registration on login
- Send notifications for all 7 event types
- Room notification toggle (admin)
- Handle notification tap (deep link to relevant screen)

**Testing:**
- Receive push when another user adds an expense
- All 7 notification types fire correctly
- Tapping notification opens the relevant screen
- Toggle OFF → no notifications
- Toggle ON → notifications resume
- Token updates on app reinstall

**Dependencies:** Phase 12 approved

---

## Phase 17: Reports & Comparison

**Objectives:**
- Monthly report screen (full breakdown)
- Category-wise expense breakdown (chart or table)
- Month-to-month comparison with difference and percentage
- Report API endpoints

**Screens:**
- Monthly Report (all line items from FEATURES.md §10.1)
- Month Comparison (two-month side-by-side)

**Testing:**
- Report data matches settlement and expense records
- Category breakdown adds up to total expenses
- Comparison shows correct difference and percentage
- Navigate between months
- Empty month → appropriate message

**Dependencies:** Phase 11 approved

---

## Phase 18: Activity History

**Objectives:**
- Activity History screen (paginated, infinite scroll)
- Grouped by date
- Detail per entry (who, what, when, old/new values)
- Filter by entity type (optional)

**Screens:**
- Activity History list
- Activity detail (expanded entry)

**Testing:**
- All tracked actions appear (expense add/edit/delete, payments, settlements, room changes)
- Correct user and timestamp (IST) shown
- Edit entries show previous → new values
- Infinite scroll loads more entries
- Pagination works without duplicates

**Dependencies:** Phase 7 approved

---

## Phase 19: Room Settings & Admin Features

**Objectives:**
- Category management UI (add, rename, disable)
- Rent management with effective date support
- Room closure flow with warning
- Complete Room tab admin settings

**Screens:**
- Category Management (list, add, rename, disable toggle)
- Rent History / Change Rent form
- Close Room confirmation (with balance warning)

**Testing:**
- Add category → appears in expense form picker
- Rename → updated everywhere
- Disable → can't use for new expenses, old ones unchanged
- Change rent → effective from date, old settlements unaffected
- Close room → read-only mode, no new actions possible
- Close with outstanding balances → warning shown first

**Dependencies:** Phase 6 approved

---

## Phase 20: Polish, Edge Cases & Final Testing

**Objectives:**
- Full regression testing across all features
- Edge case handling (empty room, single member, departed-only room, etc.)
- Performance optimization (list rendering, query caching)
- Accessibility audit (labels, contrast, dynamic type)
- Offline behavior review
- Error handling completeness
- Consistent loading/empty/error states everywhere

**Testing:**
- Complete app walkthrough on Android (and iOS if available)
- All edge cases verified
- Performance acceptable (smooth scrolling, fast navigation)
- Accessibility labels on all interactive elements
- Large system font → no clipping
- Network errors → graceful handling with retry options
- All financial calculations cross-verified

**Dependencies:** All previous phases (1–19) approved

---

## Phase 21: Deployment & Release

**Objectives:**
- Production Neon database setup
- Cloudflare Workers production deployment
- Production environment variables and secrets
- EAS production build
- Final production smoke test on devices
- Documentation finalization

**Testing:**
- Production API health check passes
- Production database migrations applied
- Production build installs and runs on devices
- All features work against production backend
- Push notifications work in production

**Dependencies:** Phase 20 approved
