import { serve } from '@hono/node-server';
import app from './index';

const port = Number(process.env.PORT) || 8787;
console.log(`Starting PG Expense Manager API on http://0.0.0.0:${port}...`);

serve(
  {
    fetch: app.fetch,
    port,
    hostname: '0.0.0.0',
  },
  (info) => {
    console.log(`PG Expense Manager API ready on http://localhost:${info.port}`);
  }
);
