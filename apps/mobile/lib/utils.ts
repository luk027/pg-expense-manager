/**
 * Format paise (integer) to Indian Rupee currency format
 * e.g. 12480000 paise -> ₹1,24,800
 * e.g. 25050 paise -> ₹250.50
 */
export function formatPaise(paise: number | bigint | null | undefined): string {
  if (paise === null || paise === undefined || Number.isNaN(Number(paise))) {
    return '₹0';
  }
  const numeric = typeof paise === 'bigint' ? Number(paise) : paise;
  if (!Number.isFinite(numeric)) return '₹0';
  const rupees = numeric / 100;
  
  const hasDecimals = numeric % 100 !== 0;
  
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });

  return formatter.format(rupees);
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number | bigint): number {
  return (typeof paise === 'bigint' ? Number(paise) : paise) / 100;
}
