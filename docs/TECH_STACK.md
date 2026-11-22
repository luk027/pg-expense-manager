# PG Expense Manager — Technology Stack

## Frontend

| Area | Technology | Notes |
|---|---|---|
| Framework | React Native | Cross-platform mobile |
| Development Platform | Expo (SDK 52+) | Managed workflow with EAS Build |
| Language | TypeScript | Strict mode |
| Routing | Expo Router v4 | File-based routing |
| Styling | NativeWind v4 | Tailwind CSS for React Native, fed by `tokens.ts` |
| State / Data | TanStack Query v5 | Server state, caching, optimistic updates |
| Forms | React Hook Form + Zod | Validation shared with backend |
| Lists | @shopify/flash-list | Performant virtualized lists |
| Calendar | react-native-calendars | Shared expense calendar |
| Bottom Sheets | @gorhom/bottom-sheet | Gesture-friendly modal sheets |
| Icons | lucide-react-native | Consistent icon set |
| Animations | react-native-reanimated | Subtle, respectful motion |
| Haptics | expo-haptics | Tactile feedback on key actions |
| Safe Areas | react-native-safe-area-context | Notch / gesture bar handling |

## Backend

| Area | Technology | Notes |
|---|---|---|
| Runtime | Cloudflare Workers (V8) | Not Node.js — V8 with Node compat layer |
| Language | TypeScript | Strict mode |
| API Framework | Hono v4 | Typed RPC client for end-to-end type safety |
| Input Validation | Zod | Shared schemas in monorepo |
| Authentication | Better Auth | Expo plugin for native + web session handling |
| Push Notifications | Expo Push / FCM | Via Expo's push service |
| Scheduled Jobs | Cloudflare Cron Triggers | Settlement date reminders |

## Database

| Area | Technology | Notes |
|---|---|---|
| Engine | PostgreSQL | Via Neon serverless |
| Hosting | Neon | Serverless Postgres |
| ORM | Drizzle ORM | Type-safe, migration-friendly |
| Migrations | drizzle-kit | Schema migrations |
| Connectivity | Cloudflare Hyperdrive (TCP) | Real transactions; query caching **disabled** for financial reads |
| Driver | postgres.js (via Hyperdrive) | TCP driver for interactive transactions |

## Monorepo & Tooling

| Area | Technology | Notes |
|---|---|---|
| Package Manager | npm | Workspaces management |
| Monorepo | Turborepo | Shared packages, build orchestration |
| Shared Packages | `@pg/shared` | Zod schemas, types, constants |
| Testing | Vitest | Unit + integration tests |
| E2E Testing | Maestro (future) | Mobile E2E |
| CI/CD | GitHub Actions | Lint, test, build pipeline |
| App Build | EAS Build | iOS and Android builds |
| Error Tracking | Sentry | Crash reporting + performance |
| Source Control | GitHub | Version control |

## Hosting & Infrastructure

| Area | Technology | Notes |
|---|---|---|
| Backend | Cloudflare Workers | Edge-deployed API |
| Frontend (Web) | Cloudflare Workers (static assets) | Per current CF recommendation |
| Database | Neon | Serverless Postgres |
| Push Service | Expo Push | Notification delivery |

## Key Architecture Decisions

1. **Integer paise** — All money stored as integers (paise). Display uses `Intl.NumberFormat('en-IN')`.
2. **Soft deletes** — Deleted records are flagged, never removed.
3. **Append-only audit** — Activity log entries are written in the same transaction as the change.
4. **Hyperdrive TCP** — Required for interactive database transactions (settlements, payment confirmations, reversals).
5. **Hono RPC** — End-to-end type safety from API definition to React Native client.
6. **Shared Zod schemas** — Validation logic shared between frontend and backend via `@pg/shared`.
