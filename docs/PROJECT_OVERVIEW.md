# PG Expense Manager — Project Overview

## 1. App Concept

PG Expense Manager is a mobile application designed for people living together in a shared room, PG (Paying Guest), or flat. It helps roommates manage shared expenses, monthly rent, recurring services, payment collection, and financial settlements transparently.

**It is strictly a shared-room expense management app — not a personal expense tracker.**

## 2. Objectives

1. **Eliminate confusion** — Every roommate sees the same financial records.
2. **Automate fair splitting** — Shared expenses are equally divided among applicable roommates.
3. **Streamline rent collection** — Track who paid, who owes, and what's been paid to the landlord.
4. **Handle Indian payment realities** — UPI and cash; Indian number grouping (₹1,24,800); monthly settlement cycles that match how Indian PGs actually work.
5. **Maintain historical integrity** — Changes in membership, prices, rent, and expenses never rewrite past financial records.
6. **Provide accountability** — Every important action is logged with the person responsible and timestamp.

## 3. Target Users

- **Primary:** Roommates in Indian PGs and shared flats (2–8 people per room).
- **Secondary:** Any shared-living arrangement needing expense splitting.

## 4. Core Features (MVP)

| Module | Priority |
|---|---|
| Room creation and invitations | Essential |
| Admin and roommate permissions | Essential |
| Shared expense entry and equal splitting | Essential |
| Rent management | Essential |
| Monthly settlement cycle (expense period ≠ settlement period) | Essential |
| Payment tracking (UPI / Cash) | Essential |
| Rent collector workflow | Essential |
| Water delivery tracking | Essential |
| Cleaner (fixed monthly) | Essential |
| Shared expense calendar | Essential |
| Push notifications | Essential |
| Activity history | Essential |
| Monthly reports with comparison | Essential |
| Expense category management | Essential |
| Room closure and archiving | Essential |

## 5. Explicitly Out of Scope (v1)

- Personal expense tracking
- Receipt / bill uploads
- Expense descriptions or notes
- Custom expense splitting (unequal shares)
- Partial payments
- Automatic "who pays whom" recommendations
- Bank transfer payment method
- Payment reminders
- Multiple room membership
- Multiple simultaneous room admins

## 6. Product Principles

1. **Simple** — Add an expense or record a delivery in seconds.
2. **Transparent** — Everyone sees the same room financial records.
3. **Accurate** — Expense periods and settlement periods stay separate.
4. **Fair** — Equal division per agreed membership rules.
5. **Accountable** — Every important change is recorded.
6. **Flexible** — Settle outstanding balances before the scheduled date.
7. **Historical Integrity** — Past records are never rewritten.

## 7. Key Design Decisions (from PRD Feedback)

These decisions were raised during PRD review and must be resolved before building the settlement engine:

### 7.1 Money Flow Model
All net balances flow through the rent collector. The collector reimburses roommates who paid shared expenses. Roommate-to-roommate direct payments are **not** supported in v1.

### 7.2 Finalized Settlement Edits
After finalization, any expense edit creates an **adjustment line** carried into the next settlement. Finalized totals are never changed retroactively.

### 7.3 "Settle Immediately" Expenses
"Settle immediately" creates a one-off micro-settlement for that single expense. It is tracked separately and excluded from the monthly settlement to prevent double-counting.

### 7.4 Multi-Month Bills
Assigned to the **last month** of the billing period. Shared among roommates present at the end of that month.

### 7.5 Membership Rules
- Joiners pay full-month rent regardless of join date.
- Shared expenses are split among roommates present at month-end.
- Departed roommates lose room access but their balance remains visible to current members.
- Admin must transfer role before leaving.
- Collector's own payment is auto-confirmed (they are the collector).

### 7.6 Rounding
All money is stored as **integer paise** (1 ₹ = 100 paise). Leftover paise from division are assigned deterministically (e.g., to the first roommate alphabetically by ID).

### 7.7 Timezone
All times are **IST (Asia/Kolkata)**. The "no future entries" rule and settlement dates use IST.

---

> **Status:** Awaiting your review and approval of these design decisions before development begins.
