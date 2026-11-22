import { describe, it, expect } from 'vitest';
import { calculateEqualPaiseShares, deriveExpensePeriod } from '../src/routes/expenses';

describe('Deterministic Equal Paise Split Engine', () => {
  it('splits ₹10.00 (1,000 paise) equally across 3 roommates with exact deterministic rounding', () => {
    const memberIds = ['u1', 'u2', 'u3'];
    const totalPaise = 1000;
    const shares = calculateEqualPaiseShares(totalPaise, memberIds);

    expect(shares).toHaveLength(3);
    const sum = shares.reduce((acc, s) => acc + s.sharePaise, 0);
    expect(sum).toBe(totalPaise);

    // Sorted: u1 gets 334 (base 333 + 1), u2 gets 333, u3 gets 333
    expect(shares.find((s) => s.userId === 'u1')?.sharePaise).toBe(334);
    expect(shares.find((s) => s.userId === 'u2')?.sharePaise).toBe(333);
    expect(shares.find((s) => s.userId === 'u3')?.sharePaise).toBe(333);
  });

  it('splits ₹28,000.00 (2,800,000 paise) equally across 4 roommates', () => {
    const memberIds = ['u1', 'u2', 'u3', 'u4'];
    const totalPaise = 2800000;
    const shares = calculateEqualPaiseShares(totalPaise, memberIds);

    expect(shares).toHaveLength(4);
    const sum = shares.reduce((acc, s) => acc + s.sharePaise, 0);
    expect(sum).toBe(totalPaise);

    for (const share of shares) {
      expect(share.sharePaise).toBe(700000); // ₹7,000 each
    }
  });

  it('handles prime numbers and odd remainders without losing a single paise', () => {
    const memberIds = ['a', 'b', 'c', 'd', 'e', 'f', 'g']; // 7 members
    const totalPaise = 10001;
    const shares = calculateEqualPaiseShares(totalPaise, memberIds);

    expect(shares).toHaveLength(7);
    const sum = shares.reduce((acc, s) => acc + s.sharePaise, 0);
    expect(sum).toBe(totalPaise);
  });

  it('handles 0 paise gracefully', () => {
    const memberIds = ['u1', 'u2'];
    const shares = calculateEqualPaiseShares(0, memberIds);
    expect(shares).toHaveLength(2);
    expect(shares[0].sharePaise).toBe(0);
    expect(shares[1].sharePaise).toBe(0);
  });
});

describe('Expense Period Assignment', () => {
  it('assigns normal expense date to its YYYY-MM period', () => {
    expect(deriveExpensePeriod('2026-11-20')).toBe('2026-11');
    expect(deriveExpensePeriod('2026-01-05')).toBe('2026-01');
  });

  it('assigns multi-month bill to the last month of the billing period', () => {
    // BESCOM bill covering Sep 1 to Oct 31 -> assigned to 2026-10
    const period = deriveExpensePeriod('2026-11-15', '2026-10-31');
    expect(period).toBe('2026-10');
  });
});
