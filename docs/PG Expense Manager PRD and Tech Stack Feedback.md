# PG Expense Manager: PRD and Tech Stack Feedback

Review of the PRD (v1.0) and the selected technology stack.

## Overall assessment

This is a strong PRD. The scope is tight, the out-of-scope list is explicit, and separating the expense period from the settlement period is the right core idea. The stack is modern and coherent. The sections below list the gaps worth closing before building starts.

## PRD: decisions to make first

### 1. Who actually receives the money?

The PRD has a rent collector, but expenses are paid by individual roommates. If A pays ₹1,000 for groceries, do the others pay A directly, or pay the collector? Section 9.3 says the app won't suggest who pays whom, yet section 9.2 shows "amount they should receive." Without a way for credits to be settled, those balances never clear.

Pick one model, for example:

- Everyone's net balance is paid to or from the collector, who also reimburses payers.
- Or allow roommate-to-roommate payments as well as collector payments.

### 2. "Finalized" settlements are editable

Because any roommate can edit or delete any expense, and finalized statements stay editable, "finalized" doesn't mean much. It also breaks the full-payment-only rule. If someone has already marked ₹4,200 as sent and an edit changes their amount to ₹4,350, what happens?

Suggested options:

- After finalization, edits create an adjustment line carried into the next settlement instead of changing the finalized totals.
- Or lock the statement and allow only a reversal.

### 3. Settlement date vs. the PRD's own example

The workflow example says payments happen before the 10th, but the default settlement date is the last day of the month. Also, "Settle immediately" is undefined. Is it a separate one-off settlement outside the monthly cycle? Define how it avoids double counting.

### 4. Multi-month electricity bills

The bill stays a single expense with a billing period, but the PRD doesn't say which expense period it belongs to for reports, or which roommates share it. Suggestion: assign it to the last month of the billing period and use membership at the end of that month.

### 5. Membership edge cases

- Joiners pay full rent but share only the expenses of months they are present at month-end. Confirm this is intended.
- If someone leaves, how is their manual settlement recorded? The collector should be able to log it.
- A departed roommate loses access, so how do they see what they owe? Consider a read-only balance view.
- The admin should have to transfer the role before leaving.
- Closing a room with outstanding balances should require a warning and confirmation.
- Who confirms the collector's own payment?

### 6. Smaller gaps

- **Rounding:** ₹1,000 across 3 people needs a rule. Store money as integer paise and assign leftover paise deterministically.
- **Rent changes:** service prices have effective dates, but rent doesn't.
- **Time zone:** fix IST for delivery times and the "no future entries" rule.
- **Duplicate water taps:** add idempotency so a double tap doesn't create two deliveries.
- **Notifications:** all six events notify everyone, which can get noisy. Consider a per-user mute even in v1.
- **Data export:** a monthly report as PDF or a WhatsApp-shareable summary would be very useful for roommates in India.
- **Privacy:** address account deletion and data handling (India's DPDP Act).

## Tech stack feedback

The stack fits well. Hono's typed RPC client pairs nicely with React Native and Zod. Points to check:

- **"Node.js" vs Workers:** Workers is not Node. It is the V8 runtime, with optional Node compatibility. Node is just your tooling. State this accurately in the doc.
- **Transactions:** settlements, payment confirmations and reversals need real database transactions. Neon's HTTP driver doesn't support interactive transactions, so use Hyperdrive with a TCP Postgres driver (postgres.js or node-postgres). That is a good reason to keep Hyperdrive. Disable its query caching for financial reads.
- **Cloudflare Pages:** Cloudflare has been steering new projects toward Workers with static assets. Check their current recommendation before committing.
- **Better Auth with Expo:** it has an Expo plugin, but test session handling on native vs. web early, since cookies behave differently.
- **Money and audit:** use integer paise, soft deletes, and an append-only activity table written in the same transaction as the change.

### Missing from the stack

- Push notifications (Expo Push / FCM) and invitation deep links that work when the app isn't installed.
- Scheduled jobs (Cloudflare Cron Triggers) for settlement-date logic, and Queues if notification fan-out grows.
- A shared package of Zod schemas in a monorepo (pnpm + Turborepo).
- Client data layer (TanStack Query) and Expo Router.
- Migrations (drizzle-kit), CI (GitHub Actions), EAS Build for app stores, and error tracking (Sentry).
- Tests for the settlement engine (Vitest). It is the riskiest logic, so unit test it heavily.

For "everyone sees the same data," refetch plus push notifications is enough for v1. Durable Objects or WebSockets can wait.

## Suggested next step

Settle the first three items (money flow, finalization/edit rules, settlement timing) in the PRD. Then build the settlement engine as a pure, well-tested TypeScript module before any UI. After that, the database schema is a natural next deliverable.
