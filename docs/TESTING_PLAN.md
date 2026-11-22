# PG Expense Manager — Testing Plan

## 1. Testing Strategy

### Levels of Testing

| Level | Tool | Scope |
|---|---|---|
| Unit Tests | Vitest | Settlement engine, utility functions, Zod schemas |
| Integration Tests | Vitest + Miniflare | API routes with database |
| Component Tests | React Native Testing Library | UI components in isolation |
| E2E Tests | Maestro (future) | Full user flows on device |
| Manual Device Testing | Expo Dev Client / Expo Go | Every phase on real devices |

### Priority

The **settlement engine** is the highest-risk logic. It must have the most comprehensive unit tests before any UI is built on top of it.

## 2. Unit Testing

### Settlement Engine (Critical — Phase 9)
- Equal splitting with 2, 3, 4, 5, 6, 7, 8 roommates
- Rounding: verify paise don't get lost (sum of shares = total)
- Expense period vs. settlement period assignment
- Carried-forward items
- Missing bills handling
- Multi-month bill assignment
- Membership changes mid-month
- Settle-immediately expenses
- Post-finalization adjustments
- Edge: single roommate, all roommates depart

### Utility Functions
- Money formatting (Indian grouping)
- Paise ↔ rupee conversion
- Date utilities (IST, period calculations)
- Validation schemas (valid + invalid inputs)

## 3. Integration Testing

### API Routes
- Auth: register, login, session management
- Room: create, invite, join, approve, settings
- Expenses: CRUD with permission checks
- Settlements: calculation, finalization
- Payments: full workflow (sent → confirmed → reversed)
- Water deliveries: including idempotency
- Activity log: entries created for all tracked actions

### Database
- Transaction integrity (settlement + activity log in one tx)
- Soft delete filtering
- Constraint enforcement (one room per user, etc.)
- Index performance on common queries

## 4. Manual Device Testing (Per Phase)

Every phase must be tested on:
- [ ] Android device (via Expo Go or Dev Client)
- [ ] iOS device (if available)

### Testing Checklist per Phase
- [ ] All new screens render correctly
- [ ] Navigation works as expected
- [ ] Forms validate correctly (valid + invalid input)
- [ ] Loading states appear while data fetches
- [ ] Empty states appear when no data exists
- [ ] Error states appear on API failure
- [ ] Pull-to-refresh works
- [ ] Data persists after app restart
- [ ] Haptic feedback fires on key actions (water tap, payment)
- [ ] Text is readable at all system font sizes
- [ ] Layout doesn't clip on small screens (360dp width)
- [ ] Safe areas respected (notch, gesture bar, bottom tabs)
- [ ] Indian number formatting correct (₹1,24,800)
- [ ] Amounts match between different screens

## 5. Regression Testing

After each phase:
- Re-test all previously approved features
- Verify no regressions in navigation, data display, or calculations
- Run existing unit/integration test suites
- Check that activity log captures all new actions

## 6. Quality Requirements

- **Zero tolerance** for incorrect financial calculations
- All money displayed in Indian grouping format
- No data loss on network errors (optimistic updates roll back cleanly)
- Activity log captures every tracked action without exception
- Soft-deleted items never appear in calculations or active lists
- All forms show validation errors clearly
- No broken navigation paths
- No unhandled promise rejections or crashes
