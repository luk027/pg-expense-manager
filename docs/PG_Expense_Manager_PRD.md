# PG Expense Manager

## Product Requirements Document (PRD)

**Document status:** Product discovery completed\
**Version:** 1.0\
**Product type:** Shared room expense and settlement management app

------------------------------------------------------------------------

# 1. Product overview

PG Expense Manager is an app designed for people living together in a
shared room or flat.

Its primary purpose is to help roommates manage shared expenses, monthly
rent, recurring services, payment collection, and financial settlements
transparently.

It is strictly a shared-room expense management app, not a personal
expense tracker.

### Main goals

-   Track all shared room expenses.
-   Calculate each roommate's equal share.
-   Maintain monthly rent and expense settlements.
-   Track who paid and who still owes money.
-   Manage recurring services such as water delivery and cleaning.
-   Provide a shared expense calendar.
-   Maintain transparent payment and activity history.
-   Reduce confusion and disagreements between roommates.

# 2. Users and roles

The app supports two roles.

## 2.1 Room admin

There is exactly one admin per room at a time.

The admin can: - Manage room information and settings. - Invite and
remove roommates. - Approve roommate join requests. - Transfer admin
responsibility. - Set and update monthly rent. - Manage expense
categories. - Configure service prices. - Set the settlement date. -
Assign the rent collector. - Enable or disable room notifications. -
Close the room.

## 2.2 Roommate

All roommates can: - View shared room expenses. - Add shared expenses. -
Edit or delete expenses. - Record water deliveries. - View the shared
calendar. - View individual and room balances. - Mark their payments as
sent. - Finalize monthly settlements. - View payment and activity
history.

The assigned rent collector has additional responsibilities: - Confirm
roommate payments. - Record rent payments made to the landlord. -
Reverse incorrect payment confirmations.

# 3. Room management

### Room creation

-   One admin creates and manages the room.
-   The room has one active admin at a time.
-   A user can belong to only one room at a time.
-   All roommates access the same shared room data.

### Invitations

1.  Admin generates an invitation link.
2.  Admin shares it with the new roommate.
3.  New roommate opens the link and requests access.
4.  Admin approves the request.
5.  The new roommate joins the room.

### Roommate departure

When a roommate leaves: - Their access to the room is removed. - Their
historical expenses and payments remain. - Their outstanding balance
remains visible. - Their outstanding balance must be settled manually. -
Previous calculations are not changed.

### Membership calculation rules

**Rent:** Equal monthly rent sharing, with a full-month share regardless
of joining or leaving date.

**Other shared expenses:** Equally divided among roommates living in the
room at the end of the expense month.

Historical membership and expense records must remain intact.

### Admin transfer

-   Only one admin can exist at a time.
-   The current admin can transfer responsibility to another active
    roommate.
-   Previous admin activity remains in history.

### Room closure

The admin can close the room.

After closure: - No new expenses or payments can be added. - Historical
expenses, settlements, and payment records remain accessible. -
Outstanding balances remain visible. - The room becomes archived.

# 4. Expense management

## 4.1 Expense entry

Every shared expense must include:

  Field                   Requirement
  ----------------------- -------------
  Expense name            Required
  Amount                  Required
  Category                Required
  Paid by                 Required
  Expense date            Required
  Settlement preference   Required

Settlement preference: - Settle immediately. - Include in monthly
settlement.

### Explicitly excluded

The app will not include: - Receipt or bill uploads. - Expense
descriptions. - Personal expense tracking. - Individual participant
selection. - Custom expense splitting.

## 4.2 Expense splitting

All shared expenses are divided equally among all applicable roommates.

No roommate can be excluded from an individual expense.

Example:

Four roommates share a ₹1,000 expense.

Each roommate's share is ₹250.

If roommate A pays the entire amount, A receives credit for the amount
paid, less their own share.

## 4.3 Default expense categories

-   Rent
-   Electricity
-   Water
-   Groceries
-   Cleaning
-   Wi-Fi
-   Gas
-   Maintenance
-   Other

Admin can: - Add categories. - Rename categories. - Disable categories.

Disabling a category must not change historical records.

## 4.4 Expense editing and deletion

Every roommate can edit or delete shared expenses.

The system must preserve: - Original entry. - Person who created it. -
Person who edited or deleted it. - Previous and updated values. - Date
and time of the change.

Deleted expenses are excluded from financial calculations but remain in
activity history.

# 5. Monthly rent and settlement cycle

This is one of the most important parts of the app.

The app must distinguish between the month an expense belongs to and the
month in which it is settled.

## 5.1 Real-life monthly workflow

Example:

**November settlement:**

Before the 10th of November, the roommates normally pay: - November
rent. - October water expenses. - October electricity bill. - October
groceries. - October cleaning expense.

Meanwhile, November expenses continue to be recorded.

**December settlement:**

-   December rent.
-   November water expenses.
-   November electricity bill.
-   November groceries.
-   November cleaning expense.

The app must support this workflow.

## 5.2 Expense period and settlement period

Every expense must retain two separate references:

1.  Expense period: When the expense actually occurred.
2.  Settlement period: When the expense is included in the payment
    calculation.

Example:

An October water expense of ₹600 is settled in November.

It must remain an October expense even after settlement.

November's new water expenses must be recorded separately.

The same expense must never be counted twice.

## 5.3 Settlement date

-   Default settlement date: Last day of each month.
-   Admin can change the settlement date.
-   Roommates can settle balances earlier.
-   The settlement date is a deadline, not a restriction on early
    payment.

The actual settlement schedule can therefore be configured to match the
room's payment arrangement.

## 5.4 Monthly settlement contents

The settlement statement should show:

-   Current month's rent.
-   Previous month's shared expenses.
-   Outstanding expenses carried forward.
-   Each roommate's share.
-   Amount already paid.
-   Remaining amount owed.
-   Total room expenses.

## 5.5 Missing bills

If a bill is unavailable during settlement:

-   Do not estimate its amount.
-   Carry it forward.
-   Record it against its original expense period when available.
-   Include it in the next settlement.
-   Never duplicate it.

## 5.6 Bills covering multiple months

Electricity bills may cover two months at once.

Example: - Bill amount: ₹2,400. - Billing period: October--November.

The app must allow the user to record the original bill period.

The bill should remain a single original expense with its full amount
and billing period. It must not be mistaken for two separate bills or
counted twice.

## 5.7 Settlement finalization

Any roommate can finalize a monthly settlement.

Workflow:

1.  Open the settlement.
2.  Review all included expenses.
3.  Review each roommate's share.
4.  Review outstanding amounts.
5.  Select Finalize Settlement.
6.  Confirm the final statement.
7.  Settlement becomes finalized.
8.  All roommates receive a notification.

Finalized statements remain editable.

Every subsequent change must be recorded in settlement history.

# 6. Water delivery and recurring services

## 6.1 Water jug tracking

Water is charged per delivery, not per jug quantity.

Admin configures the price per delivery.

Any roommate can record a delivery.

Each delivery records: - Delivery date. - Delivery time. - Price. -
Person who entered it. - Time when the entry was recorded.

### Multiple deliveries

Multiple deliveries on the same day are allowed.

Example:

  Date          Delivery time     Amount
  ------------- --------------- --------
  November 12   9:00 AM              ₹40
  November 12   6:30 PM              ₹40
  November 13   10:00 AM             ₹40

November 12 automatically totals ₹80.

### Toggle interaction

A simple shared toggle/action records a delivery.

Each delivery is a separate entry. Additional deliveries can be added on
the same day.

All roommates see the same delivery records.

### Backdated entries

Roommates can: - Add an entry for a previous date. - Specify the actual
delivery time. - Add multiple past dates in one operation. - Add
multiple deliveries for the same past date.

Future delivery entries are not allowed.

All corrections must retain activity history.

## 6.2 Cleaner

-   Cleaner expense is a fixed monthly amount.
-   Admin configures the monthly price.
-   The amount is included in the appropriate monthly settlement.
-   The cleaner payment is not automatically divided into daily
    attendance charges.

## 6.3 Service price management

Only the room admin can change service prices.

Price changes should have an effective date.

Historical expenses retain the prices applicable when they were
recorded.

# 7. Shared expense calendar

The calendar is a central feature of the app.

It displays all shared room expenses, not only recurring services.

### Calendar features

-   Monthly calendar navigation.
-   Expense indicators on dates.
-   Select a date to view complete expense details.
-   Display multiple expenses on the same date.
-   Display multiple water deliveries and their times.
-   View past expense records.
-   Filter by expense category.

### Calendar filters

-   All expenses.
-   Water.
-   Groceries.
-   Electricity.
-   Cleaning.
-   Rent.
-   Wi-Fi.
-   Gas.
-   Maintenance.
-   Other.

Selecting a date should show: - Expense name. - Amount. - Category. -
Who paid. - Date and time. - Settlement status.

# 8. Payment management

## 8.1 Payment methods

Only these payment methods are supported: - UPI. - Cash.

Bank transfer is excluded.

## 8.2 Rent collector

The room admin is the default rent collector.

The admin can assign another roommate as the collector.

Only the assigned collector: - Confirms roommate payments. - Records
rent paid to the landlord.

## 8.3 Roommate payment workflow

1.  Roommate opens their outstanding balance.
2.  Roommate makes the payment.
3.  Roommate marks payment as sent.
4.  Payment appears as awaiting confirmation.
5.  Collector confirms receipt.
6.  Payment is recorded as confirmed.

## 8.4 Payment restrictions

Partial payments are not supported.

A roommate must pay the full outstanding amount in one payment.

## 8.5 Payment cancellation

A roommate can cancel a payment marked as sent if the collector has not
confirmed it.

Cancelled payments: - Do not count as collected. - Remain in activity
history.

## 8.6 Incorrect payment confirmation

The collector can reverse an incorrect confirmation.

Requirements: - A reason is required. - Payment returns to an
unconfirmed state. - The reversal is recorded in activity history. - All
roommates receive a notification.

## 8.7 Landlord payment tracking

Landlord payments are separate from roommate collections.

The collector records the amount paid to the landlord.

The app must distinguish: - Total rent due. - Amount collected from
roommates. - Amount still pending from roommates. - Amount paid to
landlord. - Remaining landlord payment amount.

# 9. Balances and financial overview

## 9.1 Home dashboard

The Home screen should prioritize:

1.  My pending amount.
2.  Current month's room expenses.
3.  Upcoming rent settlement.
4.  Roommates' payment status.
5.  Quick actions.

Quick actions include: - Add expense. - Mark water delivery. - View
payments. - View monthly report.

## 9.2 Individual balance

Each roommate can see: - Amount they owe. - Amount they should
receive. - Confirmed payments. - Outstanding balance.

## 9.3 Room balance

All roommates can see: - Total room expenses. - Total rent. - Total
collected. - Outstanding payments. - Overall room balance.

The app must not automatically suggest who should pay whom.

Roommates decide their own payment arrangements.

# 10. Notifications

A single room-level setting controls activity notifications.

### Notification events

All roommates receive notifications when:

1.  A new shared expense is added.
2.  An existing expense is edited.
3.  An existing expense is deleted.
4.  A monthly settlement is finalized.
5.  A payment is marked as sent.
6.  A payment is confirmed.

Payment confirmation reversals also notify all roommates.

### Notification setting

Under Room Settings:

-   Notifications ON: Send the selected activity notifications.
-   Notifications OFF: Disable room activity notifications.

No individual notification configuration is required in the first
version.

Payment reminders are not included.

# 11. Reports

## 11.1 Monthly report

Each monthly report should contain:

-   Total rent.
-   Total shared expenses.
-   Category-wise expense breakdown.
-   Each roommate's share.
-   Who paid and how much.
-   Payment status.
-   Outstanding balances.
-   Expenses carried forward.
-   Historical settlement details.

## 11.2 Monthly comparison

The app should allow month-to-month comparison.

Example:

  Month        Total expenses
  ---------- ----------------
  October             ₹18,000
  November            ₹21,500

Difference: ₹3,500 increase (19.4%).

# 12. Activity history and transparency

The app must preserve a history of important actions.

Track: - Expense additions. - Expense edits. - Expense deletions. -
Water delivery entries. - Backdated entries. - Settlement
finalization. - Settlement edits. - Payment sent status. - Payment
cancellations. - Payment confirmations. - Payment confirmation
reversals. - Rent changes. - Service price changes. - Room membership
changes. - Admin transfers.

Every activity should identify the person responsible and the date and
time.

# 13. Main app navigation

Recommended bottom navigation:

1.  Home
2.  Calendar
3.  Expenses
4.  Settlement
5.  Room

### Home

Personal and room financial overview.

### Calendar

All room expenses organized by date.

### Expenses

Expense list, expense creation, and expense history.

### Settlement

Monthly statements, balances, and payment records.

### Room

Roommates, settings, categories, rent, services, notifications, and
activity history.

# 14. MVP scope

The first version should focus on the following features.

  Module                           MVP priority
  -------------------------------- --------------
  Room creation and invitations    Essential
  Admin and roommate permissions   Essential
  Shared expense entry             Essential
  Equal expense splitting          Essential
  Rent management                  Essential
  Monthly settlement               Essential
  Payment tracking                 Essential
  UPI and cash                     Essential
  Water delivery tracking          Essential
  Shared expense calendar          Essential
  Notifications                    Essential
  Activity history                 Essential
  Monthly reports                  Essential
  Expense category management      Essential
  Room closure and archiving       Essential

# 15. Explicitly out of scope

The first version will not include:

-   Personal expense tracking.
-   Receipt or bill uploads.
-   Expense descriptions.
-   Custom expense splitting.
-   Partial payments.
-   Automatic who-pays-whom recommendations.
-   Bank transfer payment method.
-   Payment reminders.
-   Multiple room membership.
-   Multiple simultaneous room admins.

# 16. Product principles

The app should follow these principles:

1.  **Simple:** Roommates should be able to add an expense or record a
    delivery quickly.
2.  **Transparent:** Everyone sees the same room financial records.
3.  **Accurate:** Expense periods and settlement periods must remain
    separate.
4.  **Fair:** Shared expenses are equally divided according to the
    agreed membership rules.
5.  **Accountable:** Every important change is recorded.
6.  **Flexible:** Roommates can settle outstanding balances before the
    scheduled date.
7.  **Historical integrity:** Changes in membership, prices, rent, and
    expenses must not rewrite previous financial records.

------------------------------------------------------------------------

**End of Product Requirements Document**
