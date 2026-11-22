# PG Expense Manager — Feature Details

## 1. Authentication & Onboarding

### 1.1 Registration
- Email + password registration via Better Auth
- Name is required
- Email verification (future enhancement)

### 1.2 Login
- Email + password login
- Session persisted on device
- Auto-login on app reopen

### 1.3 Onboarding
- After login, if user has no room: show Create Room / Join Room options
- Create Room: enter room name → become admin
- Join Room: enter/scan invite link → request access → wait for admin approval

## 2. Room Management

### 2.1 Room Creation
- Admin creates room with a name
- Admin is auto-added as first member and default collector
- Default categories are created automatically

### 2.2 Invitation System
- Admin generates a unique invite link (expires in 7 days)
- Link can be shared via any messaging app
- New user opens link → requests to join
- Admin sees pending requests → approves or rejects
- Approved user becomes an active roommate

### 2.3 Roommate Departure
- Admin can remove a roommate
- Roommate can leave voluntarily
- Historical records preserved
- Outstanding balance remains visible
- Admin must transfer role before leaving

### 2.4 Admin Transfer
- Current admin selects a new admin from active roommates
- Role transfer is immediate
- Previous admin becomes a regular roommate
- Transfer logged in activity history

### 2.5 Room Closure
- Only admin can close the room
- Warning shown if outstanding balances exist
- After closure: read-only access, no new expenses/payments
- Room becomes archived

## 3. Expense Management

### 3.1 Adding an Expense
- **Required fields:** Name, Amount (₹), Category, Paid By, Expense Date, Settlement Preference
- **Settlement preference:** "Include in monthly settlement" or "Settle immediately"
- Amount stored as integer paise
- Expense period auto-determined from expense date
- Settlement period determined by settlement workflow

### 3.2 Expense Splitting
- All shared expenses split equally among active roommates at month-end
- No exclusions — every active roommate shares every expense
- Rounding: leftover paise assigned deterministically (first roommate by sorted ID)

### 3.3 Expense Editing
- Any roommate can edit any expense
- System records: who edited, previous values, new values, timestamp
- If expense belongs to a finalized settlement → creates adjustment line in next settlement

### 3.4 Expense Deletion
- Any roommate can delete any expense (soft delete)
- Deleted expenses excluded from calculations
- Remain visible in activity history
- System records who deleted and when

### 3.5 Category Management
- 9 default categories: Rent, Electricity, Water, Groceries, Cleaning, Wi-Fi, Gas, Maintenance, Other
- Admin can add, rename, or disable categories
- Disabled categories can't be used for new expenses
- Historical records with disabled categories remain unchanged

## 4. Monthly Settlement Cycle

### 4.1 Expense Period vs. Settlement Period
- Every expense has an **expense period** (when it occurred) and a **settlement period** (when it's paid)
- Example: October water expense is settled in November's settlement
- Same expense is never counted twice

### 4.2 Settlement Contents
Each monthly settlement includes:
- Current month's rent (split equally)
- Previous month's shared expenses (split equally among month-end members)
- Outstanding items carried forward from previous settlements
- Each roommate's computed share
- Amounts already paid
- Remaining amounts owed

### 4.3 Settlement Finalization
1. Any roommate can initiate finalization
2. Review all included expenses
3. Review each roommate's share
4. Confirm finalization
5. Settlement status changes to "finalized"
6. All roommates notified
7. Post-finalization edits create adjustment lines for next period

### 4.4 Missing Bills
- If a bill isn't available: carry forward to next settlement
- Record against original expense period when available
- Include in next settlement — never duplicated

### 4.5 Multi-Month Bills
- Stored as a single expense with billing period start/end dates
- Assigned to the last month of the billing period
- Split among roommates present at end of that month

### 4.6 Settle Immediately
- Creates a one-off micro-settlement for a single expense
- Tracked separately from monthly settlement
- Each roommate's share is calculated and shown
- Payment follows the standard collector workflow

## 5. Water Delivery Tracking

### 5.1 Recording a Delivery
- One-tap delivery recording
- Records: date, time, price (from service config), who entered it
- Optimistic update with undo (5-second window)
- Idempotency key prevents duplicate taps

### 5.2 Multiple Deliveries
- Multiple deliveries on the same day allowed
- Each is a separate entry
- Day totals calculated automatically

### 5.3 Backdated Entries
- Can add entries for previous dates
- Must specify actual delivery time
- Can add multiple past dates
- Future entries are blocked (IST)

### 5.4 Price Management
- Admin sets price per delivery
- Price changes have an effective date
- Historical deliveries retain the price at time of recording

## 6. Cleaner Service
- Fixed monthly amount set by admin
- Included in the appropriate monthly settlement
- Price changes have an effective date
- Not split into daily charges

## 7. Payment Management

### 7.1 Payment Flow
1. Roommate views their outstanding balance
2. Makes payment externally (UPI or cash)
3. Marks payment as "sent" in app
4. Payment appears as "awaiting confirmation"
5. Collector confirms receipt
6. Payment recorded as "confirmed"

### 7.2 Payment Rules
- Full payment only — no partial payments
- Methods: UPI or Cash only
- Collector confirms all payments
- Collector's own payment is auto-confirmed

### 7.3 Payment Cancellation
- Roommate can cancel before collector confirms
- Cancelled payments don't count as collected
- Remain in activity history

### 7.4 Payment Reversal
- Collector can reverse an incorrect confirmation
- Reason is required
- Payment returns to unconfirmed state
- All roommates notified

### 7.5 Landlord Payment
- Separate from roommate collections
- Collector records amount paid to landlord
- Dashboard shows: total due, collected, pending, paid to landlord, remaining

## 8. Shared Expense Calendar

- Monthly calendar view with category-colored expense indicators
- Filter by category (All, Water, Groceries, Electricity, etc.)
- Tap a date to see all expenses: name, amount, category, who paid, time, settlement status
- Water deliveries show individual times and day total
- Navigate between months

## 9. Notifications

### 9.1 Notification Events
1. New expense added
2. Expense edited
3. Expense deleted
4. Settlement finalized
5. Payment marked as sent
6. Payment confirmed
7. Payment confirmation reversed

### 9.2 Settings
- Room-level toggle (admin controls)
- ON: all activity notifications sent
- OFF: all notifications disabled
- No per-user configuration in v1

## 10. Reports

### 10.1 Monthly Report
- Total rent
- Total shared expenses
- Category-wise breakdown
- Each roommate's share
- Who paid and how much
- Payment status
- Outstanding balances
- Expenses carried forward

### 10.2 Month-to-Month Comparison
- Compare any two months
- Show difference in total expenses
- Percentage change

## 11. Activity History

### 11.1 Tracked Actions
- Expense: add, edit, delete
- Water delivery: add, backdate
- Settlement: finalize, edit after finalize
- Payment: sent, cancel, confirm, reverse
- Room: rent change, service price change, member join/depart, admin transfer
- Category: add, rename, disable

### 11.2 Log Entry Format
- Who performed the action
- What action was performed
- What entity was affected
- Previous and new values (where applicable)
- Timestamp (IST)
