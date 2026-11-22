import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { isDbConnected, schema } from './db';
import auth from './routes/auth';
import rooms from './routes/rooms';
import expenses from './routes/expenses';
import settlements from './routes/settlements';
import payments from './routes/payments';
import services from './routes/services';
import notifications from './routes/notifications';
import reports from './routes/reports';
import activity from './routes/activity';

export const APP_NAME = 'PG Expense Manager';
export const APP_VERSION = '1.0.0';

type Bindings = {
  ENVIRONMENT?: string;
  DATABASE_URL?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS for mobile and web clients
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Mount API routes
app.route('/api/auth', auth);
app.route('/api/rooms', rooms);
app.route('/api/rooms', expenses);
app.route('/api/rooms', settlements);
app.route('/api/rooms', payments);
app.route('/api/rooms', services);
app.route('/api/rooms', reports);
app.route('/api/rooms', activity);
app.route('/api/notifications', notifications);
app.route('/api', notifications);

// Root welcome route
app.get('/', (c) => {
  return c.json({
    name: APP_NAME,
    version: APP_VERSION,
    status: 'online',
    docs: '/api/docs',
  });
});

// Health check endpoint
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'pg-expense-manager-api',
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
    environment: c.env?.ENVIRONMENT || process.env.ENVIRONMENT || 'development',
  });
});

// Database health and schema inspection endpoint
app.get('/api/db/health', (c) => {
  const connected = isDbConnected();
  const tables = Object.keys(schema).filter(
    (key) => !key.endsWith('Relations') && !key.endsWith('Enum')
  );

  return c.json({
    databaseConfigured: connected,
    driver: 'postgres.js / Drizzle ORM',
    totalTables: tables.length,
    tables,
    enums: [
      'room_status',
      'room_role',
      'member_status',
      'settlement_preference',
      'settlement_status',
      'payment_method',
      'payment_status',
      'service_type',
      'invitation_status',
    ],
    timestamp: new Date().toISOString(),
  });
});

export default app;
