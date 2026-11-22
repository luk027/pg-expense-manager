import { getDb, schema } from './index';

export const DEFAULT_CATEGORIES = [
  'Rent',
  'Electricity',
  'Water',
  'Groceries',
  'Cleaning',
  'Wi-Fi',
  'Gas',
  'Maintenance',
  'Other',
];

export async function seedDefaultCategories(roomId: string) {
  const db = getDb();
  if (!db) {
    console.warn('[Seed] No database connection available to seed categories');
    return [];
  }

  const categoryInserts = DEFAULT_CATEGORIES.map((catName) => ({
    roomId,
    name: catName,
    isDefault: true,
    isActive: true,
  }));

  const inserted = await db
    .insert(schema.roomCategories)
    .values(categoryInserts)
    .returning();

  return inserted;
}
