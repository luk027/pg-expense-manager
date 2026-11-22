# PG Expense Manager — UI/UX Design

## 1. Design System

The app follows a **calm fintech** design direction — clean, trustworthy, numbers-first.

See the existing [UI Design Guide](PG%20Expense%20Manager%20UI%20Design%20Guide.md) for complete design tokens, cross-platform best practices, and component specifications.

### Key Principles
1. One consistent look on iOS and Android.
2. Numbers are the hero — big, tabular, high-contrast amounts.
3. Colour means something — blue for actions, green for settled, red for owed, amber for pending.
4. Soft elevation, not heavy borders.
5. Minimum 48dp tap targets, 16px screen padding, 8-point spacing grid.

### Design Tokens
Single source of truth in `tokens.ts`:
- **Colors:** bg, surface, surfaceMuted, border, ink, inkSecondary, primary, success, danger, warning, accent
- **Spacing:** xs(4), sm(8), md(12), lg(16), xl(24), xxl(32)
- **Radius:** sm(8), md(12), lg(16), pill(999)
- **Typography:** display(32), title(20), body(16), label(14), caption(12)

## 2. Navigation Structure

**Bottom Tab Navigation** (5 tabs, labels always visible, active pill indicator):

```
┌──────┬──────────┬──────────┬────────────┬──────┐
│ Home │ Calendar │ Expenses │ Settlement │ Room │
└──────┴──────────┴──────────┴────────────┴──────┘
```

## 3. Screen Map

### Auth Flow
- **Login Screen** — Email + password, link to register
- **Register Screen** — Name, email, password
- **Onboarding** — Create room or join via invite link

### Home Tab
- Greeting with room name
- Hero card: "You owe ₹X" / "You get ₹X" with Pay button
- Two-up cards: month's room expenses, rent status
- Roommate payment status list (avatars + status pills)
- Quick actions: Add Expense, Water Delivery, Payments, Report

### Calendar Tab
- Monthly grid with category-colored dots
- Horizontal filter chip row
- Selected date's expenses listed below
- Water shows "2 deliveries, ₹80"

### Expenses Tab
- Expense list grouped by date
- Floating action button (FAB) to add expense
- Sticky month switcher at top
- Each item: name, amount, category badge, paid by

### Settlement Tab
- Statement card: rent, previous expenses, carried forward, your share, paid, remaining
- Collection progress bar
- Payment history list
- Finalize Settlement button

### Room Tab
- Roommates section (list with roles, status)
- Rent & Services section
- Categories section
- Notifications toggle
- Activity History section
- Room Settings (admin only)

### Modal Screens
- **Add Expense** — Bottom sheet or full screen: name, amount, category, paid by, date, settlement preference
- **Water Delivery** — Quick tap with delivery time; backdated option
- **Payment** — Mark as sent (amount auto-filled, select UPI/Cash)
- **Confirm Payment** — Collector confirms receipt
- **Invite Roommate** — Generate and share invite link

## 4. Component Library (Build First)

| Component | Purpose |
|---|---|
| `Card` | Surface, border, platform shadow |
| `Button` | Primary, secondary, destructive, disabled, loading |
| `Badge` | Status pills: icon + text (settled, owes, awaiting, collector) |
| `Amount` | Tabular Indian-grouped currency with semantic color |
| `Input` | Text input with label, error state |
| `Select` | Dropdown / picker |
| `DatePicker` | Platform-appropriate date selection |
| `BottomSheet` | Gesture-friendly modal |
| `EmptyState` | Illustration + message + action |
| `LoadingSkeleton` | Shimmer placeholder |
| `ErrorState` | Error message + retry |
| `PullToRefresh` | Pull-to-refresh wrapper |
| `Avatar` | User avatar with fallback initials |
| `StatusPill` | Payment/settlement status indicator |

## 5. States to Design

Every screen must handle:
- ✅ **Loaded** — Normal data display
- ⏳ **Loading** — Skeleton shimmer
- 📭 **Empty** — Friendly message + action ("No expenses this month. Add the first one.")
- ❌ **Error** — Error message + retry button
- 🔄 **Refreshing** — Pull-to-refresh indicator
- 📡 **Offline** — Offline notice banner

## 6. Money Display Rules

- Indian grouping: ₹1,24,800 via `Intl.NumberFormat('en-IN')`
- Tabular nums: `fontVariant: ['tabular-nums']`
- Decimals only when non-zero (₹250 not ₹250.00, but ₹250.50 when applicable)
- Semantic text: "You owe ₹4,200" not just "-₹4,200"
- Color: red for owed, green for settled/receivable, default for neutral
