export const APP_NAME = 'PG Expense Manager';
export const APP_VERSION = '1.0.0';

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
] as const;

export type DefaultCategory = (typeof DEFAULT_CATEGORIES)[number];
