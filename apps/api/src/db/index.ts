import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import * as dotenv from 'dotenv';
dotenv.config();

export function getDb(customUrl?: string) {
  if (dbInstance) {
    return dbInstance;
  }

  const connectionString = customUrl || process.env.DATABASE_URL;
  if (connectionString) {
    const client = postgres(connectionString, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    dbInstance = drizzle(client, { schema });
    return dbInstance;
  }

  return null;
}

export function isDbConnected(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export { schema };
