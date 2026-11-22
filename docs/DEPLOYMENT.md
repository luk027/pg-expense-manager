# PG Expense Manager — Deployment

## 1. Development Environment

### Prerequisites
- Node.js 20+
- npm 10+
- Expo CLI (`npx expo`)
- Wrangler CLI (`npx wrangler`)
- Expo Go app on mobile device (for QR code testing)
- Git

### Setup
```bash
# Clone the repo
git clone <repo-url>
cd pg-expense-manager

# Install dependencies
pnpm install

# Set up environment variables
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
# Edit .env files with your Neon connection string, auth secrets, etc.

# Run database migrations
pnpm --filter api db:migrate

# Start development (both mobile + API)
pnpm dev
```

### Development Servers
- **Mobile:** `pnpm --filter mobile start` → Expo dev server with QR code
- **API:** `pnpm --filter api dev` → Wrangler local dev server on port 8787

### QR Code Testing
1. Start the dev server: `cd apps/mobile && pnpm start`
2. Scan the QR code with Expo Go (Android/iOS)
3. Ensure mobile device and dev machine are on the **same network**
4. API must be running for data features to work

## 2. Database

### Neon Setup
1. Create a Neon project at https://neon.tech
2. Copy the connection string
3. Set `DATABASE_URL` in `apps/api/.env`
4. Run migrations: `pnpm --filter api db:migrate`

### Migration Commands
```bash
# Generate a new migration from schema changes
pnpm --filter api db:generate

# Run pending migrations
pnpm --filter api db:migrate

# Push schema directly (dev only, skips migration files)
pnpm --filter api db:push
```

## 3. API Deployment (Cloudflare Workers)

### Configuration
- `apps/api/wrangler.toml` — Workers config
- Hyperdrive binding for Neon (TCP mode, caching disabled)
- Secrets: `BETTER_AUTH_SECRET`, `DATABASE_URL`, `EXPO_PUSH_ACCESS_TOKEN`

### Deploy Commands
```bash
# Deploy to staging
pnpm --filter api deploy:staging

# Deploy to production
pnpm --filter api deploy:production

# Set secrets
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put DATABASE_URL
```

### Cloudflare Cron Triggers
- Settlement date reminders (configured in `wrangler.toml`)

## 4. Mobile App Build (EAS)

### Prerequisites
- Expo account
- EAS CLI: `npm install -g eas-cli`
- `eas.json` configured in `apps/mobile/`

### Build Profiles

```bash
# Development build (includes dev tools, QR testing)
eas build --platform android --profile development

# Preview build (internal testing, no dev tools)
eas build --platform all --profile preview

# Production build (app store submission)
eas build --platform all --profile production
```

### Over-the-Air Updates
```bash
# Push an OTA update (JS changes only)
eas update --branch production --message "Bug fix description"
```

## 5. Environment Variables

### API (`apps/api/.env`)
```env
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=http://localhost:8787  # or production URL
EXPO_PUSH_ACCESS_TOKEN=your-expo-push-token
```

### Mobile (`apps/mobile/.env`)
```env
EXPO_PUBLIC_API_URL=http://localhost:8787
# Production: https://api.pgexpense.app
```

## 6. CI/CD (GitHub Actions)

### On Pull Request
1. Lint (ESLint + Prettier)
2. Type check (`tsc --noEmit`)
3. Unit tests (Vitest)
4. Integration tests
5. Build check

### On Merge to Main
1. All PR checks
2. Deploy API to staging
3. Trigger EAS preview build

### On Release Tag
1. Deploy API to production
2. Trigger EAS production build
3. Submit to app stores (future)

## 7. Monitoring

- **Error Tracking:** Sentry (crashes + performance)
- **API Metrics:** Cloudflare Workers analytics
- **Database:** Neon dashboard (queries, connections)
- **Push Notifications:** Expo push receipts
