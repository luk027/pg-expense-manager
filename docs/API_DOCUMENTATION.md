# PG Expense Manager — API Documentation

## Overview

- **Base URL:** `https://api.pgexpense.app` (production) / `http://localhost:8787` (development)
- **Protocol:** HTTPS
- **Format:** JSON
- **Auth:** Better Auth session token (cookie-based)
- **Framework:** Hono v4 with typed RPC
- **Validation:** Zod schemas (shared via `@pg/shared`)

## Authentication

### POST /api/auth/register
Register a new user.

**Body:**
```json
{
  "name": "string",
  "email": "string",
  "password": "string"
}
```

**Response:** `201 Created` with session cookie.

### POST /api/auth/login
Log in and receive session.

**Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response:** `200 OK` with session cookie.

### POST /api/auth/logout
End current session.

**Response:** `200 OK`, session cookie cleared.

### GET /api/auth/session
Get current session / user info.

**Response:** `200 OK` with user object, or `401 Unauthorized`.

## Rooms

### POST /api/rooms
Create a new room. User becomes admin and default collector.

**Body:**
```json
{
  "name": "string",
  "monthlyRentPaise": "number"
}
```

### GET /api/rooms/current
Get the current user's active room with members.

### PATCH /api/rooms/:roomId
Update room settings (admin only). Fields: name, monthlyRentPaise, settlementDay, notificationsEnabled.

### POST /api/rooms/:roomId/close
Close and archive a room (admin only).

### POST /api/rooms/:roomId/invite
Generate an invite link (admin only). Returns a unique token with 7-day expiry.

### POST /api/rooms/:roomId/join
Request to join a room using an invite token.

**Body:**
```json
{
  "token": "string"
}
```

### POST /api/rooms/:roomId/members/:memberId/approve
Approve a pending member (admin only).

### POST /api/rooms/:roomId/members/:memberId/remove
Remove a member (admin only). Sets status to 'departed'.

### POST /api/rooms/:roomId/transfer-admin
Transfer admin role to another active member.

**Body:**
```json
{
  "newAdminUserId": "string"
}
```

### PATCH /api/rooms/:roomId/collector
Assign rent collector (admin only).

**Body:**
```json
{
  "collectorUserId": "string"
}
```

## Expenses

### GET /api/rooms/:roomId/expenses
List expenses with optional filters.

**Query params:** `period` (YYYY-MM), `categoryId`, `page`, `limit`

### POST /api/rooms/:roomId/expenses
Add a new shared expense. Auto-calculates equal shares.

**Body:**
```json
{
  "name": "string",
  "amountPaise": "number",
  "categoryId": "string",
  "paidByUserId": "string",
  "expenseDate": "YYYY-MM-DD",
  "settlementPreference": "monthly | immediate",
  "billingPeriodStart": "YYYY-MM-DD (optional)",
  "billingPeriodEnd": "YYYY-MM-DD (optional)"
}
```

### PATCH /api/rooms/:roomId/expenses/:expenseId
Edit an expense. Logs previous values in activity.

### DELETE /api/rooms/:roomId/expenses/:expenseId
Soft-delete an expense. Excluded from calculations.

## Categories

### GET /api/rooms/:roomId/categories
List room categories (active and inactive).

### POST /api/rooms/:roomId/categories
Add a category (admin only).

### PATCH /api/rooms/:roomId/categories/:categoryId
Update or disable a category (admin only).

## Settlements

### GET /api/rooms/:roomId/settlements
List all settlements for the room.

### GET /api/rooms/:roomId/settlements/:period
Get settlement details for a specific period (YYYY-MM).

### POST /api/rooms/:roomId/settlements/:period/finalize
Finalize a settlement. Locks amounts, notifies all roommates.

### GET /api/rooms/:roomId/settlements/:period/statement
Get the full settlement statement with all line items and member shares.

## Payments

### POST /api/rooms/:roomId/payments
Mark payment as sent. Amount must equal full outstanding balance.

**Body:**
```json
{
  "settlementId": "string",
  "method": "upi | cash",
  "idempotencyKey": "string"
}
```

### POST /api/rooms/:roomId/payments/:paymentId/confirm
Confirm payment receipt (collector only).

### POST /api/rooms/:roomId/payments/:paymentId/cancel
Cancel a sent payment (payer only, before confirmation).

### POST /api/rooms/:roomId/payments/:paymentId/reverse
Reverse a confirmed payment (collector only).

**Body:**
```json
{
  "reason": "string (required)"
}
```

### POST /api/rooms/:roomId/landlord-payments
Record a landlord payment (collector only).

**Body:**
```json
{
  "settlementId": "string",
  "amountPaise": "number",
  "method": "upi | cash",
  "paidAt": "ISO 8601 datetime"
}
```

## Water Deliveries

### GET /api/rooms/:roomId/water-deliveries
List water deliveries. **Query params:** `period` (YYYY-MM), `date` (YYYY-MM-DD).

### POST /api/rooms/:roomId/water-deliveries
Record a water delivery.

**Body:**
```json
{
  "deliveryDate": "YYYY-MM-DD",
  "deliveryTime": "HH:mm",
  "idempotencyKey": "string"
}
```

### DELETE /api/rooms/:roomId/water-deliveries/:deliveryId
Delete a water delivery (soft delete).

## Services

### GET /api/rooms/:roomId/services
Get current service configurations (water price, cleaner price).

### PATCH /api/rooms/:roomId/services/:serviceType
Update service price (admin only). serviceType: 'water' or 'cleaner'.

**Body:**
```json
{
  "pricePaise": "number",
  "effectiveFrom": "YYYY-MM-DD"
}
```

## Reports

### GET /api/rooms/:roomId/reports/monthly/:period
Get monthly report for a period (YYYY-MM).

### GET /api/rooms/:roomId/reports/comparison
Compare two months.

**Query params:** `period1` (YYYY-MM), `period2` (YYYY-MM).

## Activity Log

### GET /api/rooms/:roomId/activity
List activity history (paginated).

**Query params:** `page`, `limit`, `entityType` (optional filter).

## User

### POST /api/users/push-token
Register or update the device's Expo push token.

**Body:**
```json
{
  "token": "string"
}
```

---

> **Note:** Full request/response schemas are defined using Zod in `@pg/shared` and auto-documented via Hono's typed RPC. Each development phase will include detailed API specs for the endpoints implemented in that phase.
