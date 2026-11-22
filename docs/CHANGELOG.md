# PG Expense Manager — Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Phase 21 — Deployment & Release
**Date:** 2026-11-22

- **Cloudflare Workers Production Deployment & Bundling:**
  - Production `apps/api/wrangler.toml` configured with staging (`pg-expense-manager-api-staging`) and production (`pg-expense-manager-api-prod`) environments.
  - Automated cron triggers configured (`0 9 * * *`) for daily 9 AM settlement alerts.
  - Verified Cloudflare bundle generation (`wrangler deploy --dry-run`): 887 KiB bundle (163 KiB gzipped), 0 bundling errors.
- **Expo Mobile Production Release & EAS Configuration:**
  - Configured `apps/mobile/eas.json` with `development`, `preview` (internal testing APK), and `production` (store App Bundle) channels.
  - Verified production mobile bundle export (`npx expo export --platform android`): 1,319 modules bundled, Hermes bytecode bundle `_expo/static/js/android/entry-*.hbc` (3.4MB), exported cleanly to `dist/`.
- **Production Health & Database Inspection Endpoints:**
  - `GET /api/health`: Live production health check returning service name, status (`ok`), timestamp, and environment.
  - `GET /api/db/health`: Database schema validation returning all 14 database tables and 9 PostgreSQL enums.
  - Resolved route interception in `apps/api/src/index.ts` ensuring public health endpoints remain accessible without Bearer auth.
- **Milestone Completed:** All 22 project phases (0–21) implemented, tested (351 automated tests passing, 0 TypeScript errors), and ready for release.

### Phase 20 — Polish, Edge Cases & Final Testing
**Date:** 2026-11-22

- **Automated Edge Case Test Suite (`apps/api/test/phase20-edge-cases-test.ts`):**
  - **Single-Member Room Lifecycle:** Verified clean expense creation, 100% single-member share allocation (no division by zero), and draft settlement calculation.
  - **Deterministic Integer Paise Arithmetic:** Verified exact allocations with odd remainders (e.g. ₹100 split across 3 members yields 3334, 3333, 3333 with 0 paise discrepancy).
  - **Zero Rent & Zero Expense Calculations:** Validated clean zero paise statements without `NaN` or unhandled exceptions.
  - **Payment Rules & Reversals:** Partial payment rejection, negative payment validation, and reversal reason enforcement.
  - **Archival Immutability:** Verified closed rooms reject expense additions, rent changes, and invitations (`403 Forbidden`), and that reopening successfully restores active state.
- **Mobile Polish & Resilience:**
  - **Currency & Decimal Safety (`apps/mobile/lib/utils.ts`):** Hardened `formatPaise` against `null`, `undefined`, and `NaN` inputs, falling back cleanly to `'₹0'`.
  - **Accessibility Enhancements:** Added `accessibilityLabel` and `accessible` attributes across `Input.tsx`, `Avatar.tsx`, and `Badge.tsx` to support screen readers and dynamic type scaling without text clipping.
  - **Safe Area Insets:** Audited and verified top insets across all tabs and modal screens to prevent header and action button clipping under Android status bars and iOS dynamic islands.
- **Monorepo Health:**
  - 0 TypeScript errors across `apps/api` and `apps/mobile`.
  - 37/37 Phase 20 edge case tests passing.
  - 351/351 total automated tests passing across the repository (345 integration + 6 Vitest unit tests).

### Phase 19 — Room Settings & Admin Features
**Date:** 2026-11-22

- **Category Management Backend & Frontend:**
  - `POST /api/rooms/:roomId/categories`: Admin can create custom expense categories with duplicate detection and length validation.
  - `PATCH /api/rooms/:roomId/categories/:categoryId`: Admin can rename category or toggle `isActive` flag.
  - `DELETE /api/rooms/:roomId/categories/:categoryId`: In-use categories are protected and soft-disabled (`isActive: false`) to preserve historical statements and expenses, while unused categories are permanently deleted.
  - Built dedicated `apps/mobile/app/category-management.tsx` screen:
    - Lists active vs disabled categories with visual badges.
    - Modals for adding new categories and renaming existing categories.
    - Enable / Disable switch toggles with confirmation warnings.
    - Delete button with safe soft-disable feedback.
  - Updated `add-expense.tsx` and `edit-expense.tsx` to hide disabled categories for new expenses.
- **Rent Revision Management with Effective Date:**
  - `GET /api/rooms/:roomId/rent/history`: Returns complete log of past rent changes and current monthly rent.
  - `POST /api/rooms/:roomId/rent`: Validates positive paise amount and `YYYY-MM-DD` effective date; captures previous rent, new rent, changer user, and optional reason.
  - Room Settings UI (`apps/mobile/app/room-settings.tsx`):
    - Displays current monthly rent in Indian currency format (`₹28,000 / month`).
    - Collapsible rent revision history log with effective dates, changer names, and revision reasons.
    - Modal to schedule or apply rent revisions with automated 1st-of-next-month date suggestion.
- **Room Closure Flow & Balance Gate Check:**
  - `GET /api/rooms/:roomId/close-check`: Pre-flight check inspecting unfinalized expenses in current period and unpaid settlement shares.
  - `POST /api/rooms/:roomId/close`: Requires `force: true` if unfinalized expenses or unpaid balances exist; returns `409 Conflict` otherwise to prevent accidental closure with outstanding money.
  - Closed rooms become read-only: blocks rent changes, expense creations, and invitations (`403 Forbidden`).
  - `POST /api/rooms/:roomId/reopen`: Admin can restore archived room back to active state.
  - Room Settings UI:
    - Pre-flight warning modal displaying exact count of unpaid balances, outstanding rupees, and pending roommates.
    - Explicit acknowledgement toggle required for force-closure.
    - Archived room banner and "Reopen Room" button if the room is closed.
- **Monorepo Health:**
  - 0 TypeScript errors across `apps/api` and `apps/mobile`.
  - 46/46 Phase 19 admin settings automated tests passing.
  - 314 total automated tests passing without regressions.

### Phase 18 — Activity History & Audit Log
**Date:** 2026-11-22

- **Backend Activity REST API (`apps/api/src/routes/activity.ts`):**
  - `GET /api/rooms/:roomId/activity`:
    - Fully paginated, filterable activity history and room audit log
    - Query parameters: `page`, `limit` (max 100), `filter` (`all`, `expenses`, `payments`, `settlements`, `water`, `room`), `userId`
    - Rich activity enrichment: Actor full name, user email, entity categorization, human-friendly titles with formatted paise amounts (`formatPaiseStr`), action descriptions, and deep link targets
    - Automatic filter counts calculation (`filterCounts: { all, expenses, payments, settlements, water, room }`)
    - Pagination metadata with `page`, `limit`, `total`, `totalPages`, and `hasMore`
    - Full backward-compatibility preserving `logs` array for existing test harnesses
  - `GET /api/rooms/:roomId/activity/:id`:
    - Retrieves full single activity event detail with before/after value diffs for edit actions
  - Pre-seeded comprehensive 20+ demo events spanning Today, Yesterday, This Week, Earlier This Month, and October 2026
  - 42/42 automated integration tests passing in `apps/api/test/activity-api-test.ts`
- **Mobile Frontend (`apps/mobile/context/ActivityContext.tsx`, `apps/mobile/app/activity-history.tsx`):**
  - `ActivityContext`: Manages activities timeline state, active filter, filter counters, pagination state (`page`, `hasMore`), infinite scroll trigger (`loadMore`), pull-to-refresh (`refreshActivities`), and selected activity for inspection
  - Built Activity History screen (`/activity-history`):
    - Sticky horizontal filter bar with 6 category chips and active counter badges
    - Date-grouped timeline sections: **Today**, **Yesterday**, **This Week**, **Earlier This Month**, **October 2026**
    - Color-coded entity badges: Purple for Expenses, Green for Payments, Amber for Settlements, Blue for Water, Slate for Room
    - Inline edit variance pills showing previous ➔ updated amounts (`Amount: ₹1,399 ➔ ₹1,599`)
    - Relative timestamps (`Just now`, `15m ago`, `2h ago`, `Yesterday`) and IST formatting
    - Interactive slide-up bottom modal sheet for deep event inspection with full metadata and before/after diff tables
    - Direct "View Related Record" button on detail sheet linking to `/expense-detail`, `/payment-history`, `/statement-detail`, etc.
    - Infinite scroll with loading indicators and `EmptyState` when filters yield 0 records
  - Integrated Activity History row into the Room tab (`apps/mobile/app/(tabs)/room.tsx`) under Room Management
  - Added Activity Clock shortcut button on the Home dashboard header (`apps/mobile/app/(tabs)/index.tsx`)
- Monorepo health: 0 TypeScript errors across mobile & api; 260 automated tests passing (29 Vitest + 42 Activity + 41 Reports + 52 Notifications + 22 Services + 20 Payments + 27 Settlements + 27 Expenses)

---

### Phase 17 — Reports & Month Comparison
**Date:** 2026-11-21

- **Backend Reports REST API (`apps/api/src/routes/reports.ts`):**
  - `GET /api/rooms/:roomId/reports/monthly?period=YYYY-MM`:
    - Full monthly financial report with rent, total shared expenses, carried forward items, adjustments, and grand total in integer paise
    - Dynamic category breakdown with item counts, integer paise amounts, category hex colors, and exact percentage distribution (~100%)
    - Member summaries with equal shares, upfront expenses paid, net balance owed, and payment statuses (`confirmed`, `sent`, `settled`, `pending`)
    - Water delivery counts and aggregate price summation
    - Supports finalized locked settlements with stored locked member shares, as well as live draft cycles
  - `GET /api/rooms/:roomId/reports/comparison?basePeriod=YYYY-MM&comparePeriod=YYYY-MM`:
    - Side-by-side comparison between any two monthly billing cycles
    - Computes net grand total differences, expense variance, and percentage shift in integer paise
    - Computes category shift deltas (base vs compare) sorted by highest absolute spending shift
  - `GET /api/rooms/:roomId/reports/overview`:
    - Summary across recorded room billing cycles (Oct, Nov, etc.)
  - 41/41 automated integration tests passing in `apps/api/test/reports-api-test.ts`
- **Mobile Frontend (`apps/mobile/context/ReportContext.tsx`, `apps/mobile/app/reports.tsx`):**
  - `ReportContext`: Manages active monthly report, month comparison data, billing cycle overviews, and native sharing routines with offline demo fallbacks
  - Built Financial Reports screen (`/reports`) with segmented tab switcher:
    - **Monthly Breakdown Tab:**
      - Period selector pills with finalized indicators
      - Financial Hero Card with grand total, per-roommate breakdown, and dual rent/expense metrics
      - Visual horizontal stacked multi-color category bar showing spend proportions
      - Categorized item list with counts, percentages, and paise amounts
      - Roommate settlement shares list with avatars, upfront deductions, and payment status badges
    - **Month Comparison Tab:**
      - Two-period selectors with instant period switching
      - Net variance hero card with green/amber directional delta badge (`+₹889 (+2.8%)`)
      - Side-by-side comparison boxes (Base Month vs Compare Month totals and expenses)
      - Category shift deltas showing previous ➔ current amounts and directional change percentages
    - **Native Share Sheet Integration:** One-tap export to WhatsApp, SMS, or Email with clean, itemized text formatting for monthly reports and comparisons
  - Integrated "Reports" tile into 2x2 Quick Action grid on the Home dashboard (`apps/mobile/app/(tabs)/index.tsx`)
  - Safe area status bar inset handling preventing overlap with phone battery/network icons
- Monorepo health: 0 TypeScript errors across mobile & api; 218 automated tests passing (29 Vitest + 41 Reports + 52 Notifications + 22 Services + 20 Payments + 27 Settlements + 27 Expenses)

---

### Phase 16 — Notifications (Push)
**Date:** 2026-11-20

- **Backend Push Notification Service (`apps/api/src/services/notification-service.ts`):**
  - Integrated Expo Push Notification service (`https://exp.host/--/api/v2/push/send`) with payload validation, audio/badge triggers, and mock/offline fallback
  - Implemented all 7 canonical event broadcasts:
    1. `expense_created` — Broadcast when new expense is added with Indian currency formatting
    2. `expense_updated` — Broadcast on expense edit with updated amount
    3. `expense_deleted` — Broadcast on soft deletion
    4. `settlement_finalized` — Broadcast on monthly settlement finalization with statement deep link
    5. `payment_sent` — Direct notification to Rent Collector with confirmation deep link
    6. `payment_confirmed` — Direct celebration notification to payer with receipt deep link
    7. `payment_reversed` — Direct alert notification to payer with reversal audit reason
    - Bonus `water_delivery_logged` — Broadcast on 1-touch water delivery logging
  - Room notification toggle support: Automatically respects `rooms.notificationsEnabled`; suppresses all notifications when disabled by admin
  - Automatic recipient filtering: excludes event author from receiving redundant self-notifications
- **Backend REST API (`apps/api/src/routes/notifications.ts`):**
  - `POST /api/notifications/token` — Registers/updates user's Expo push token
  - `GET /api/notifications/token` — Retrieves currently registered push token
  - `GET /api/rooms/:roomId/notifications` — Chronological query of room notifications
  - `POST /api/rooms/:roomId/notifications/test` — Live endpoint to trigger any of the 7 event types for testing
  - 52/52 integration tests passing in `apps/api/test/notifications-api-test.ts`
- **Mobile Frontend (`apps/mobile/context/NotificationContext.tsx`, `apps/mobile/app/notifications.tsx`):**
  - `NotificationContext` configures foreground presentation behavior (`shouldShowAlert`, `shouldPlaySound`, `shouldShowList`, `shouldSetBadge`)
  - Handles automatic device push token registration with backend sync
  - Deep linking listener: Tapping any notification opens the corresponding target route (`/(tabs)/expenses`, `/collector-confirmations`, `/payment-history`, `/statement-detail`, `/water-delivery`)
  - Built Notification Center screen (`/notifications`) with relative timestamps (`Just now`, `15m ago`, `2h ago`), category-colored event icons, unread badge pills, and "Mark all read"
  - Interactive live test toolbar on device to fire test notifications for all 7 event types
  - Added Notification Bell icon with dynamic unread counter badge to Home dashboard header
- Monorepo health: 0 TypeScript errors across mobile & api; 150 automated tests passing (29 Vitest + 52 Notifications + 22 Services + 20 Payments + 27 Settlements)

---

### Phase 15 — Home Dashboard
**Date:** 2026-11-20

- **Mobile Home Dashboard (`apps/mobile/app/(tabs)/index.tsx`):**
  - **Context-Aware Header:** Time-of-day greeting (e.g. `Good evening, Rahul`), room badge (`Flat 302, Green Glen`), collector badge, and pending join request alert
  - **Dynamic Hero Settlement Card:**
    - Connected to `useSettlement()`, `usePayments()`, and `useRoom()` for live calculation
    - Owed balance: `You owe ₹X` with upfront credit deduction and dynamic `Pay` CTA navigating to `/pay-settlement`
    - Confirmed balance: `All Settled Up!` with green checkmark and `View Receipt` CTA
    - Sent balance: `Payment Sent` with amber clock icon and awaiting confirmation note
    - Live due date badge counting down to room's monthly settlement day
    - Collector progress strip: real-time collected funds vs total room due with progress bar
  - **Pending Confirmations Alert Strip:** Collector callout banner when roommate payments are awaiting review
  - **Two-Up Metric Cards:**
    - Room Expenses: Current month total spend with itemized counts (`5 shared · 8 water cans`), tap opens Expenses tab
    - Monthly Rent: Total room rent (`₹28,000`), per-person split (`₹7,000 / person`), and Landlord Payout status badge (`Paid` / `Pending`), tap opens Landlord Payout modal
  - **Quick Action Grid (2x2):** Add Expense (`/add-expense`), Water Delivery (`/water-delivery`), Payments (`/payment-history`), Report (`/statement-detail`)
  - **Roommate Payment Status Roster:** Interactive member list with avatars, role pills (`Collector` / `Admin`), upfront contributions, net owed amounts, and live `StatusPill` badges
  - **Pull-to-Refresh & Skeleton:** Integrated `RefreshControl` concurrently syncing 5 stores, plus `LoadingSkeleton` during initial load
- 0 TypeScript errors across monorepo; 29 Vitest + 27 Settlement + 20 Payment + 22 Services API tests passing

---

### Phase 14 — Shared Expense Calendar
**Date:** 2026-11-20

- **Mobile Shared Calendar View (`apps/mobile/app/(tabs)/calendar.tsx`):**
  - Interactive monthly calendar grid calculating correct day offsets (SUN–SAT) and dates
  - Dynamic category-colored indicator dots for days with financial activity (Water: Sky Blue, Rent: Indigo, Groceries: Emerald, Wi-Fi: Purple, Electricity: Amber, Maid: Pink)
  - Supports up to 3 distinct category dots per day cell with numeric overflow badges
  - Horizontal category filter chips (`All`, `Water`, `Groceries`, `Wi-Fi`, `Electricity`, etc.) filtering both calendar dots and itemized activity list
  - Monthly Summary strip displaying total monthly spend in paise, count of active spend days, and delivered water can count
  - Today ring indicator and selected day blue pill highlight with 1-tap "Today" quick return
  - Itemized daily spend breakdown showing individual shared room expenses, split shares, and water deliveries with timestamps and payers
  - Empty state with `+ Add Expense` CTA for days without financial activity
  - Top safe-area status bar insets applied to eliminate Android and iOS status bar overlap
- Clean TypeScript compilation across `apps/mobile` and `apps/api` with 0 errors
- All 98 monorepo test suites passing (29 Vitest + 27 Settlement + 20 Payment + 22 Services)

---

### Phase 13 — Water Delivery & Services (Backend + Frontend)
**Date:** 2026-11-20

- **Backend REST API (`apps/api/src/routes/services.ts`):**
  - `GET /api/rooms/:roomId/services/configs` — Retrieves active water delivery rate (₹40 / 4,000 paise) and cleaner monthly salary (₹3,000 / 300,000 paise) with price history
  - `PUT /api/rooms/:roomId/services/configs` — Admin updates service pricing with `effectiveFrom` dates; non-admin blocked with 403 Forbidden
  - `GET /api/rooms/:roomId/water-deliveries` — Lists water deliveries sorted by date & time with month/date filtering and aggregate counts/costs
  - `POST /api/rooms/:roomId/water-deliveries` — Quick-tap delivery logging:
    - Enforces no future dates validation (`deliveryDate <= currentISTDate`)
    - Client UUID idempotency prevents duplicate clicks
    - Automatically pulls active price as of delivery date
  - `POST /api/rooms/:roomId/water-deliveries/bulk` — Backdating multiple deliveries or past dates in one transaction
  - `DELETE /api/rooms/:roomId/water-deliveries/:id` — Soft-deletes delivery (enabling 5-second Undo toast)
  - 22/22 API integration tests passed in `apps/api/test/services-api-test.ts`
- **Frontend Architecture & Context (`apps/mobile/context/WaterServiceContext.tsx`):**
  - Reactive `WaterServiceContext` with optimistic updates, countdown timer, and offline caching
  - Seamless 5-second Undo toast capability on quick-tap delivery
  - Pre-seeded Flat 302 historical October (15 deliveries) and November (8 deliveries, including PRD canonical Nov 12 double delivery totaling ₹80)
- **Mobile UI Screens:**
  - `apps/mobile/app/water-delivery.tsx`: Main water tracking screen with month switcher, 1-touch quick log hero card, live undo toast, monthly statistics, and date-grouped delivery list with individual timestamps and delete action
  - `apps/mobile/app/backdate-water.tsx`: Modal for backdating past deliveries (quick date chips: Today, Yesterday, 2 Days Ago), time picker, and quantity selector (1, 2, 3 deliveries)
  - `apps/mobile/app/service-config.tsx`: Admin modal to adjust water delivery rate and monthly maid/cleaner salary with effective dates
  - Integrated safe area top insets across all headers, eliminating status bar collisions
  - Connected water delivery shortcut tiles on Home dashboard and Expenses tab
- 0 TypeScript errors across monorepo; 22/22 services tests + 20/20 payments tests + 27/27 settlements tests + 29/29 Vitest tests passing

---

### Phase 12 — Payment Management (Backend + Frontend)
**Date:** 2026-11-20

- **Backend API (`apps/api/src/routes/payments.ts`):**
  - `GET /api/rooms/:roomId/payments` — Lists all roommate payments and landlord disbursements with optional settlement period filter
  - `GET /api/rooms/:roomId/payments/pending` — Collector review queue of pending roommate payment confirmations
  - `POST /api/rooms/:roomId/payments` — Roommate marks payment as sent to Rent Collector:
    - Enforces strict "Full Payment Only" rule: `amountPaise` must equal outstanding net balance
    - Auto-confirms Rent Collector's own net payment immediately
    - Idempotency key tracking prevents accidental duplicate payments
  - `POST /api/rooms/:roomId/payments/:paymentId/confirm` — Collector confirms receipt of funds, immediately updating settlement share dues
  - `POST /api/rooms/:roomId/payments/:paymentId/cancel` — Roommate cancels unconfirmed pending payment
  - `POST /api/rooms/:roomId/payments/:paymentId/reverse` — Collector reverses previously confirmed payment with mandatory audit reason (minimum 3 chars), reinstating dues
  - `POST /api/rooms/:roomId/landlord-payments` — Collector records full monthly property rent payout (e.g. ₹28,000) to landlord
  - 20/20 API integration tests passed in `apps/api/test/payments-api-test.ts`
- **Frontend Architecture & Context (`apps/mobile/context/PaymentContext.tsx`):**
  - `PaymentContext` provides `sendPayment`, `confirmPayment`, `cancelPayment`, `reversePayment`, and `recordLandlordPayment`
  - Integrated reactive cache with offline simulation fallbacks
  - Pre-seeded Flat 302 historical October 2026 payments (Rahul ₹4,300, Aman ₹7,900, Kunal ₹7,900, Sameer ₹7,900, Landlord ₹28,000)
- **Mobile UI Screens:**
  - `apps/mobile/app/pay-settlement.tsx`: Roommate payment submission modal with pre-filled exact balance, UPI vs. Cash selector, and collector details
  - `apps/mobile/app/collector-confirmations.tsx`: Collector approval queue with one-tap confirmation and reject actions
  - `apps/mobile/app/pay-landlord.tsx`: Collector rent disbursement recorder with beneficiary details, amount, and payment mode
  - `apps/mobile/app/payment-history.tsx`: Multi-tab payment ledger (All, Roommates, Landlord Rent) with status badges, timestamps, and collector reversal dialog
  - `apps/mobile/app/(tabs)/settlement.tsx`: Integrated dynamic "Pay Collector" CTA for owing roommates, collector pending confirmation banner, quick tools, and real-time payment status pills in the roommate roster
  - `apps/mobile/app/_layout.tsx`: Registered new modal screens and wrapped stack in `PaymentProvider`
- 0 TypeScript errors across monorepo; 29/29 Vitest settlement engine tests pass

---

### Phase 11 — Settlement (Frontend)
**Date:** 2026-11-20

- Created `SettlementContext` (`apps/mobile/context/SettlementContext.tsx`) for reactive settlement state:
  - Connects to Phase 10 Settlement API (`GET /settlements`, `GET /settlements/:period`, `POST /finalize`, `GET /statement`)
  - Features real-time local draft calculation fallback using pure settlement engine
  - Pre-seeds finalized October 2026 record and live November 2026 draft
- Revamped Settlement Tab (`apps/mobile/app/(tabs)/settlement.tsx`):
  - Month navigation bar (`< November 2026 >`) with fast browsing across cycles
  - Status banner distinguishing Draft vs. Finalized states
  - Room statement card with breakdown of rent, shared expenses, and carried-forward dues
  - Personal share highlight card displaying equal share, upfront expense credit deductions, and net amount owed
  - Collection progress bar (collected vs. total due, percentage pill)
  - Roommate settlement roster showing each flatmate's upfront contributions and net owed balance with status pill (Paid vs. Pending)
- Built Full Statement Detail Screen (`apps/mobile/app/statement-detail.tsx`):
  - Itemized statement with rent line item and individual shared expense rows
  - Roommate balance reconciliation table
  - Native OS Share Sheet integration to share statement summary with roommates
- Built Finalize Settlement Modal (`apps/mobile/app/finalize-modal.tsx`):
  - Explanatory banner on freezing financial calculations
  - Complete pre-finalization financial summary review
  - "Lock & Finalize Settlement" trigger with confirmation alert
- Monorepo compiles cleanly with 0 TypeScript errors

---

### Phase 10 — Settlement Engine (API)
**Date:** 2026-11-20

- Implemented Settlement REST API in `apps/api/src/routes/settlements.ts`:
  - `GET /api/rooms/:roomId/settlements` — Lists all room settlements (historical finalized + current month draft summary)
  - `GET /api/rooms/:roomId/settlements/:period` — Retrieves specific period settlement (real-time draft or locked finalized)
  - `POST /api/rooms/:roomId/settlements/:period/finalize` — Finalization workflow: locks amounts, sets `finalizedAt`, stores immutable member shares, prevents double-finalization (idempotent), logs activity
  - `GET /api/rooms/:roomId/settlements/:period/statement` — Full itemized statement with rent line items, individual shared expenses, and per-roommate net balances
- Pre-seeded October 2026 finalized settlement for Flat 302 (Rent ₹28,000 + Bi-monthly power ₹3,600 = ₹31,600, ₹7,900 each)
- Verified with 27 automated integration tests in `apps/api/test/settlements-api-test.ts` (100% passing)
- Zero TypeScript errors across both `apps/api` and `apps/mobile`

---

### Phase 9 — Settlement Engine (Core Logic + Unit Tests)
**Date:** 2026-11-20

- Built pure TypeScript settlement calculation engine (`apps/api/src/services/settlement-engine.ts`):
  - Zero external UI, DB, or API dependencies; pure functional core
  - Strict integer paise arithmetic throughout all calculations (zero floating-point error)
  - `calculateEqualPaiseShares`: Deterministic remainder distribution preserving exact equality
  - `calculateSettlement`: Calculates monthly rent shares, aggregated expense shares, upfront payer credits, carried-forward items, and post-finalization adjustments
  - Computes per-roommate net balance owed (`totalSharePaise - expensePaidPaise`)
  - Strict adherence to the Net Settlement Invariant:
    `sum(netAmountOwedPaise) === totalRentPaise + totalCarriedForwardPaise + totalAdjustmentsPaise`
- Handles all complex financial business edge cases:
  - Equal splits across 2, 3, 4, 5, 6, 7, 8 roommates
  - Multi-month utility bills (assigned to final billing month)
  - Mid-month member joins (full rent, expenses from join date)
  - Mid-month member departures (expenses up to departure date)
  - Settle-immediately exclusion from monthly settlement statements
  - Carried-forward missing bills and post-finalization adjustments
  - Edge amounts: single member, zero expenses, very large (₹15,00,000+), very small (₹1)
- Comprehensive test coverage:
  - 23 dedicated unit tests passing in Vitest (`apps/api/src/services/settlement-engine.test.ts`)
  - Full suite of 29 tests passing across the API workspace
  - Clean TypeScript compilation with 0 errors

---

### Phase 8 — Expense Management (Frontend)
**Date:** 2026-11-20

- Created `ExpenseContext` (`apps/mobile/context/ExpenseContext.tsx`) for reactive state management:
  - Connects to Phase 7 REST API endpoints with smooth offline fallback for standalone device testing
  - Period and category-filtered expenses
  - Dynamic equal paise share calculations on the client
- Revamped Expenses Tab (`apps/mobile/app/(tabs)/expenses.tsx`):
  - Sticky month navigation switcher (`< November 2026 >`)
  - Monthly Spend Overview card (Total Shared Spend & User Personal Share)
  - Category filter chips bar (All Categories, Rent, Wi-Fi, Groceries, Water, etc.)
  - Grouped expenses by date with category badges, payer names, and per-person split amounts
  - Pull-to-refresh and Floating Action Button (FAB)
  - Empty state with CTA when no expenses exist for a selected month
- Built Add Expense Screen (`apps/mobile/app/add-expense.tsx`):
  - Hero currency input in Rupees with automatic integer paise conversion
  - Live split calculator card showing per-roommate equal split in real time
  - Category horizontal chip picker
  - Roommate paid-by chip selector with avatars
  - Expense date field
  - Multi-month utility toggle for bi-monthly bills with start and end date inputs
  - Settlement cycle preference toggle (Monthly vs. Immediate)
- Built Expense Detail Screen (`apps/mobile/app/expense-detail.tsx`):
  - Full details view with category pill, total formatted in Indian currency
  - Paid-by info card with settlement preference
  - Multi-month billing period info badge
  - Complete equal paise shares breakdown across all roommates
  - Edit and Delete action buttons with destructive confirmation dialog
- Built Edit Expense Screen (`apps/mobile/app/edit-expense.tsx`):
  - Pre-filled with existing data
  - Live share recalculation as amounts are adjusted
- Registered modal presentation routes in `apps/mobile/app/_layout.tsx`
- Monorepo compiles cleanly with 0 TypeScript errors

---

### Phase 7 — Expense Management (Backend)
**Date:** 2026-11-20

- Implemented deterministic paise equal-splitting engine (`calculateEqualPaiseShares`):
  - Strict integer paise arithmetic without floating-point errors
  - Deterministic tie-breaking for remainder paise (alphabetically sorted active members)
  - Guarantees `sum(shares) === totalAmountPaise` under all odd divisions
- Implemented Expense Period Assignment (`deriveExpensePeriod`):
  - Normal expenses assigned to `YYYY-MM` of their expense date
  - Multi-month bills (with `billingPeriodStart` and `billingPeriodEnd`) assigned to the final billing month
- Implemented Expense Management REST API in `apps/api/src/routes/expenses.ts`:
  - `GET /api/rooms/:roomId/expenses` — Query expenses with `period` (YYYY-MM), `categoryId`, and pagination filters
  - `GET /api/rooms/:roomId/expenses/:expenseId` — Single expense breakdown with payer and member shares
  - `POST /api/rooms/:roomId/expenses` — Add new expense, automatically calculating equal paise shares across active room members
  - `PATCH /api/rooms/:roomId/expenses/:expenseId` — Edit expense with audit history and share recalculation
  - `DELETE /api/rooms/:roomId/expenses/:expenseId` — Soft-delete expense (preserves record, hides from active ledger, logs activity)
- Implemented Room Category REST API:
  - `GET /api/rooms/:roomId/categories` — Fetch all categories (default + custom)
  - `POST /api/rooms/:roomId/categories` — Admin-only custom category creation
  - `PATCH /api/rooms/:roomId/categories/:categoryId` — Admin-only update or toggle active state
- Pre-seeded realistic demo expenses for Flat 302 (Rent ₹28,000, Airtel Wi-Fi ₹1,199, Blinkit Groceries ₹2,450, Bisleri Water ₹480, BESCOM multi-month electricity ₹3,600)
- Automated verification:
  - 6 unit tests passing in Vitest (`apps/api/test/expenses.test.ts`)
  - 21 integration tests passing across all endpoints (`apps/api/test/expenses-api-test.ts`)
  - Total: 27 passing tests, 0 failures

---

### Phase 6 — Room Management (Frontend)
**Date:** 2026-11-20

- Created `RoomContext` (`apps/mobile/context/RoomContext.tsx`) providing reactive room state and actions connected to Phase 5 API:
  - Room metadata, active members, pending join requests, category list, and role permission flags (`isAdmin`, `isCollector`)
  - `createRoom()`, `updateRoom()`, `generateInvite()`, `joinRoom()`, `approveMember()`, `removeMember()`, `transferAdmin()`, `assignCollector()`, `closeRoom()`
- Built Create Room modal (`apps/mobile/app/create-room.tsx`) with room name, monthly rent (rupees to paise conversion), and settlement day picker
- Built Join Room modal (`apps/mobile/app/join-room.tsx`) with invite code input and join submission
- Built Invite Roommate modal (`apps/mobile/app/invite-modal.tsx`) with dynamic token generation from backend, 1-tap copy, and native OS share sheet integration
- Built Room Settings screen (`apps/mobile/app/room-settings.tsx`) featuring:
  - Monthly rent updating with admin permission enforcement
  - Notifications toggle
  - Rent Collector selector allowing 1-tap delegation to any active roommate
  - Admin Transfer confirmation dialog with safety checks
  - Danger Zone room closure and archiving action
- Revamped Room tab (`apps/mobile/app/(tabs)/room.tsx`):
  - Onboarding state for users without a room ("Create Room" / "Join Room")
  - Room header with name, member count, and total rent
  - Pending join requests banner with 1-tap "Approve" button for admin
  - Active roommate roster displaying role pills (`Admin & Collector`, `Admin`, `Collector`, `Roommate`) and remove actions
- Integrated dynamic room metadata into Home tab (`apps/mobile/app/(tabs)/index.tsx`)
- Zero TypeScript compilation errors across the monorepo

---

### Phase 5 — Room Management (Backend)
**Date:** 2026-11-20

- Implemented full Room Management REST API in `apps/api/src/routes/rooms.ts`:
  - `POST /api/rooms` — Room creation with creator as admin & collector, automatic seeding of 9 default categories
  - `GET /api/rooms/current` — Current room inspection (active members, pending join requests, categories, role permissions)
  - `PATCH /api/rooms/:roomId` — Admin settings update (name, rent in paise, settlement day, notifications)
  - `POST /api/rooms/:roomId/close` — Room closure and archiving
  - `POST /api/rooms/:roomId/invite` — Cryptographically secure 7-day invitation link generation
  - `POST /api/rooms/join` — Join room by invitation token (places user in `pending` state)
  - `POST /api/rooms/:roomId/members/:memberId/approve` — Admin member approval (transitions from `pending` to `active`)
  - `POST /api/rooms/:roomId/members/:memberId/remove` — Admin member removal (marks status as `departed`, preserving all historical ledger records)
  - `POST /api/rooms/:roomId/transfer-admin` — Immediate admin role handover to another active roommate
  - `PATCH /api/rooms/:roomId/collector` — Rent collector designation
  - `GET /api/rooms/:roomId/activity` — Room-level audit history query
- Enforced strict business rules:
  - Exactly one active room per user
  - Exactly one room admin at a time
  - Admin cannot be deleted without prior role transfer
  - Non-admin attempts to execute administrative actions return HTTP 403 Forbidden
- Executed comprehensive automated test suite verifying all 9 lifecycle flows with zero errors

---

### Phase 4 — Base UI Component Library
**Date:** 2026-11-20

- Built complete Calm Fintech reusable component library in `apps/mobile/components/ui/`:
  - `Card`: Surface container with hairline border and soft cross-platform elevation
  - `Button`: 5 variants (`primary`, `secondary`, `destructive`, `outline`, `ghost`), 3 sizes (`sm`, `md`, `lg`), loading spinner, and disabled states
  - `Amount`: Tabular Indian currency formatter (`₹1,24,800`) with semantic coloring (`owed`, `received`, `pending`, `neutral`, `primary`)
  - `Badge`: Category and role indicator with semantic tints
  - `StatusPill`: Payment/settlement status indicator (`confirmed`, `settled`, `awaiting`, `pending`, `draft`, `reversed`)
  - `Input`: Form field with focus states, error messages, and icon slots
  - `Avatar`: Deterministic initial avatars and photo support across 4 sizes
  - `LoadingSkeleton`: Animated pulsing skeleton loader for cards and text lines
  - `EmptyState`: Friendly empty state with icon, message, and call-to-action
  - `ErrorState`: Error alert container with retry button
- Built an interactive Component Showcase screen (`apps/mobile/app/showcase.tsx`) accessible directly from the Room tab to test all component variants, sizes, and states live on device
- Zero TypeScript compilation errors across the monorepo

---

### Phase 3 — Authentication (Backend + Frontend)
**Date:** 2026-11-20

- Implemented backend auth API routes in `apps/api/src/routes/auth.ts`:
  - `POST /api/auth/register` (Zod validation, duplicate check, bcrypt password hashing)
  - `POST /api/auth/login` (email/password verification, secure session token generation)
  - `GET /api/auth/session` (bearer token validation)
  - `POST /api/auth/logout` (token revocation)
- Implemented `authMiddleware` in `apps/api/src/middleware/auth.ts` for route protection
- Pre-seeded instant demo accounts (`rahul@pgexpense.com` and `aman@pgexpense.com`)
- Created `AuthContext` in `apps/mobile/context/AuthContext.tsx` with persistent device storage via `@react-native-async-storage/async-storage`
- Built Calm Fintech Login screen (`apps/mobile/app/(auth)/login.tsx`) with 1-tap quick demo login buttons
- Built Register screen (`apps/mobile/app/(auth)/register.tsx`) with full validation and password confirmation
- Integrated dynamic route protection in `apps/mobile/app/_layout.tsx` (unauthenticated users directed to Login, authenticated users to Tabs)
- Added dynamic profile card and "Sign Out" button to Room tab
- All automated tests passed: login, registration, session verification, and token invalidation

---

### Phase 2 — Database Schema & Migrations
**Date:** 2026-11-20

- Installed Drizzle ORM (`drizzle-orm`, `drizzle-kit`) and `postgres.js` driver in `apps/api`
- Implemented complete PostgreSQL schema across 14 tables in `apps/api/src/db/schema.ts`:
  - `users`, `rooms`, `room_members`, `room_categories`
  - `expenses`, `expense_shares`, `settlements`, `settlement_member_shares`
  - `payments`, `landlord_payments`, `water_deliveries`, `service_configs`
  - `room_invitations`, `activity_log`
- Configured 9 PostgreSQL ENUM types for strict type safety
- Defined foreign key relationships, composite indexes, and unique constraints
- Configured Drizzle Kit (`drizzle.config.ts`) and generated initial migration `0000_daily_metal_master.sql`
- Created seed utility (`apps/api/src/db/seed.ts`) for default expense categories
- Implemented `/api/db/health` endpoint on Hono API to verify database and schema status
- Updated TypeScript types and verified 0 compilation errors across the monorepo

---

### Phase 1 — Monorepo Setup & Dev Environment
**Date:** 2026-11-20

- Initialized npm workspaces monorepo (`apps/mobile`, `apps/api`)
- Removed standalone shared packages per user feedback, embedding utilities directly
- Configured Expo SDK 58 with Expo Router v58 in `apps/mobile`
- Configured Hono API in `apps/api` with health check endpoint (`/api/health`)
- Implemented calm fintech design system in `tokens.ts`
- Built complete 5-tab navigation skeleton:
  - Home: Hero balance card ("You owe ₹4,250"), 2-up metrics, 2x2 quick actions, roommate status
  - Calendar: Shared calendar grid with category dots, filter chips, date entries
  - Expenses: Grouped expense list with category tags, split calculations
  - Settlement: Monthly statement breakdown card, personal share calculation, collection progress bar
  - Room: Member list with admin/collector roles, room configuration rows
- TypeScript compilation passed with zero errors across all workspaces
- Local dev servers started and verified:
  - API dev server listening on `http://0.0.0.0:8787`
  - Metro bundler listening on `http://192.168.113.107:8081`

---

### Phase 0 — Project Planning & Documentation
**Date:** 2026-11-20

- Analyzed PRD (v1.0), tech stack document, UI design guide, and PRD feedback
- Resolved open design decisions (money flow, finalization edits, settle immediately, multi-month bills, membership rules, rounding, timezone)
- Created comprehensive project documentation:
  - PROJECT_OVERVIEW.md — App concept, objectives, features, scope
  - TECH_STACK.md — Technologies, frameworks, libraries, tools
  - APP_ARCHITECTURE.md — Monorepo structure, data flow, design patterns
  - DATABASE_DESIGN.md — Complete schema with 14 tables
  - UI_UX_DESIGN.md — Screens, navigation, component library, design system
  - FEATURES.md — Detailed feature specifications
  - DEVELOPMENT_PHASES.md — 22-phase development roadmap
  - API_DOCUMENTATION.md — All API endpoints
  - TESTING_PLAN.md — Testing strategy and quality requirements
  - DEPLOYMENT.md — Build, deploy, and release instructions
  - PROGRESS.md — Phase tracking dashboard

---

*This changelog will be updated with each development phase.*
