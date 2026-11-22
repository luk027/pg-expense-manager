import { describe, it, expect } from 'vitest';
import {
  calculateEqualPaiseShares,
  calculateSettlement,
  SettlementMemberInput,
  SettlementExpenseInput,
} from './settlement-engine';

describe('Phase 9: Settlement Engine — Unit Tests', () => {
  // -------------------------------------------------------------
  // 1. Equal Split Across Member Counts (2 to 8 members)
  // -------------------------------------------------------------
  describe('Equal Split Across Various Roommate Counts', () => {
    it.each([2, 3, 4, 5, 6, 7, 8])(
      'splits ₹28,000 (2,800,000 paise) across %i roommates with exact sum conservation',
      (count: number) => {
        const memberIds = Array.from({ length: count }, (_, i) => `u${i + 1}`);
        const totalRent = 2800000;
        const shares = calculateEqualPaiseShares(totalRent, memberIds);

        expect(shares).toHaveLength(count);
        const sum = shares.reduce((acc, s) => acc + s.sharePaise, 0);
        expect(sum).toBe(totalRent);

        // Max difference between any two roommates should be at most 1 paise
        const amounts = shares.map((s) => s.sharePaise);
        const max = Math.max(...amounts);
        const min = Math.min(...amounts);
        expect(max - min).toBeLessThanOrEqual(1);
      }
    );

    it('splits ₹10 (1,000 paise) across 3 roommates deterministically: 334, 333, 333', () => {
      const shares = calculateEqualPaiseShares(1000, ['u1', 'u2', 'u3']);
      expect(shares).toEqual([
        { userId: 'u1', sharePaise: 334 },
        { userId: 'u2', sharePaise: 333 },
        { userId: 'u3', sharePaise: 333 },
      ]);
      expect(shares.reduce((a, s) => a + s.sharePaise, 0)).toBe(1000);
    });
  });

  // -------------------------------------------------------------
  // 2. Rounding & Conservation of Money Invariant
  // -------------------------------------------------------------
  describe('Rounding & Conservation of Money', () => {
    it('never loses a paise for prime divisors and odd remainders', () => {
      // 10,003 paise across 7 roommates: 10003 / 7 = 1429 base, remainder 0
      // 10,006 paise across 7 roommates: 10006 / 7 = 1429 base, remainder 3 -> 3 get 1430, 4 get 1429
      const total = 10006;
      const members = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'];
      const shares = calculateEqualPaiseShares(total, members);

      expect(shares.reduce((sum, s) => sum + s.sharePaise, 0)).toBe(total);
      expect(shares.filter((s) => s.sharePaise === 1430)).toHaveLength(3);
      expect(shares.filter((s) => s.sharePaise === 1429)).toHaveLength(4);
    });

    it('handles 1 paise across 4 roommates without duplicating or losing it', () => {
      const shares = calculateEqualPaiseShares(1, ['u1', 'u2', 'u3', 'u4']);
      expect(shares.reduce((sum, s) => sum + s.sharePaise, 0)).toBe(1);
      expect(shares[0].sharePaise).toBe(1);
      expect(shares[1].sharePaise).toBe(0);
      expect(shares[2].sharePaise).toBe(0);
      expect(shares[3].sharePaise).toBe(0);
    });
  });

  // -------------------------------------------------------------
  // 3. Rent Split + Expense Split Combined
  // -------------------------------------------------------------
  describe('Combined Rent and Expense Settlement', () => {
    const demoMembers: SettlementMemberInput[] = [
      { userId: 'u1', name: 'Rahul Sharma', joinedAt: '2026-01-01', status: 'active' },
      { userId: 'u2', name: 'Aman Verma', joinedAt: '2026-01-01', status: 'active' },
      { userId: 'u3', name: 'Kunal Patel', joinedAt: '2026-01-01', status: 'active' },
      { userId: 'u4', name: 'Sameer Rao', joinedAt: '2026-01-01', status: 'active' },
    ];

    it('calculates full monthly statement with rent and multiple expenses', () => {
      const expenses: SettlementExpenseInput[] = [
        // Rahul paid Rent ₹28,000 (handled via monthlyRentPaise)
        // Aman paid Wi-Fi ₹1,200 (120,000 paise)
        {
          id: 'exp-wifi',
          name: 'Wi-Fi',
          amountPaise: 120000,
          paidByUserId: 'u2',
          expenseDate: '2026-11-03',
          expensePeriod: '2026-11',
          settlementPreference: 'monthly',
        },
        // Kunal paid Groceries ₹2,400 (240,000 paise)
        {
          id: 'exp-groc',
          name: 'Groceries',
          amountPaise: 240000,
          paidByUserId: 'u3',
          expenseDate: '2026-11-08',
          expensePeriod: '2026-11',
          settlementPreference: 'monthly',
        },
      ];

      const stmt = calculateSettlement({
        roomId: 'room-302',
        period: '2026-11',
        monthlyRentPaise: 2800000, // ₹28,000
        members: demoMembers,
        expenses,
      });

      expect(stmt.totalRentPaise).toBe(2800000);
      expect(stmt.totalExpensesPaise).toBe(360000); // 120,000 + 240,000
      expect(stmt.grandTotalPaise).toBe(3160000);

      // Rent per member: 2,800,000 / 4 = 700,000 paise (₹7,000)
      // Total expenses: 360,000 / 4 = 90,000 paise (₹900)
      // Total share each = 790,000 paise (₹7,900)
      for (const m of stmt.memberStatements) {
        expect(m.rentSharePaise).toBe(700000);
        expect(m.expenseSharePaise).toBe(90000);
        expect(m.totalSharePaise).toBe(790000);
      }

      // Check Net Balances:
      // u1 (Rahul): paid 0 upfront expenses -> owes 790,000 paise
      // u2 (Aman): paid 120,000 upfront expenses -> owes 790,000 - 120,000 = 670,000 paise
      // u3 (Kunal): paid 240,000 upfront expenses -> owes 790,000 - 240,000 = 550,000 paise
      // u4 (Sameer): paid 0 upfront expenses -> owes 790,000 paise
      const rahul = stmt.memberStatements.find((m) => m.userId === 'u1')!;
      const aman = stmt.memberStatements.find((m) => m.userId === 'u2')!;
      const kunal = stmt.memberStatements.find((m) => m.userId === 'u3')!;
      const sameer = stmt.memberStatements.find((m) => m.userId === 'u4')!;

      expect(rahul.netAmountOwedPaise).toBe(790000);
      expect(aman.netAmountOwedPaise).toBe(670000);
      expect(kunal.netAmountOwedPaise).toBe(550000);
      expect(sameer.netAmountOwedPaise).toBe(790000);

      // Invariant: sum of netAmountOwed MUST equal totalRentPaise (since expenses net to 0)
      const totalOwed = stmt.memberStatements.reduce((sum, m) => sum + m.netAmountOwedPaise, 0);
      expect(totalOwed).toBe(2800000);
    });
  });

  // -------------------------------------------------------------
  // 4. Carried-Forward & Missing Bills
  // -------------------------------------------------------------
  describe('Carried Forward Items & Missing Bills', () => {
    const members: SettlementMemberInput[] = [
      { userId: 'u1', name: 'Rahul', joinedAt: '2026-01-01', status: 'active' },
      { userId: 'u2', name: 'Aman', joinedAt: '2026-01-01', status: 'active' },
    ];

    it('correctly includes carried-forward items from previous month', () => {
      const stmt = calculateSettlement({
        roomId: 'r1',
        period: '2026-11',
        monthlyRentPaise: 2000000,
        members,
        expenses: [],
        carriedForwardItems: [
          {
            id: 'cf-1',
            description: 'Unpaid October electricity arrears',
            amountPaise: 50000, // ₹500
            userId: 'u2',
            originalPeriod: '2026-10',
          },
        ],
      });

      expect(stmt.totalCarriedForwardPaise).toBe(50000);
      const aman = stmt.memberStatements.find((m) => m.userId === 'u2')!;
      expect(aman.carriedForwardPaise).toBe(50000);
      expect(aman.totalSharePaise).toBe(1000000 + 50000); // 10,000 + 500
    });

    it('omits missing bill with zero estimate; bill can be added to next settlement', () => {
      // Month has no electricity bill yet (missing bill)
      const stmt = calculateSettlement({
        roomId: 'r1',
        period: '2026-11',
        monthlyRentPaise: 2000000,
        members,
        expenses: [],
      });

      expect(stmt.totalExpensesPaise).toBe(0);
      expect(stmt.grandTotalPaise).toBe(2000000);
    });
  });

  // -------------------------------------------------------------
  // 5. Multi-Month Bill Support
  // -------------------------------------------------------------
  describe('Multi-Month Bill Support', () => {
    it('assigns multi-month bill to the final month of the billing period', () => {
      const members: SettlementMemberInput[] = [
        { userId: 'u1', name: 'Rahul', joinedAt: '2026-01-01', status: 'active' },
        { userId: 'u2', name: 'Aman', joinedAt: '2026-01-01', status: 'active' },
      ];

      const expenses: SettlementExpenseInput[] = [
        {
          id: 'exp-bi-monthly-power',
          name: 'Bi-monthly Electricity (Aug-Sep)',
          amountPaise: 360000,
          paidByUserId: 'u1',
          expenseDate: '2026-10-05',
          expensePeriod: '2026-09', // Assigned to September (last month of Aug-Sep)
          billingPeriodStart: '2026-08-01',
          billingPeriodEnd: '2026-09-30',
          settlementPreference: 'monthly',
        },
      ];

      // If we calculate for 2026-09, the bill IS included
      const sepStmt = calculateSettlement({
        roomId: 'r1',
        period: '2026-09',
        monthlyRentPaise: 2000000,
        members,
        expenses,
      });
      expect(sepStmt.totalExpensesPaise).toBe(360000);

      // If we calculate for 2026-10, the bill is NOT included
      const octStmt = calculateSettlement({
        roomId: 'r1',
        period: '2026-10',
        monthlyRentPaise: 2000000,
        members,
        expenses,
      });
      expect(octStmt.totalExpensesPaise).toBe(0);
    });
  });

  // -------------------------------------------------------------
  // 6. Member Joins or Departs Mid-Month
  // -------------------------------------------------------------
  describe('Mid-Month Membership Changes', () => {
    it('charges full rent to a roommate who joins mid-month (e.g. joined Nov 15)', () => {
      const members: SettlementMemberInput[] = [
        { userId: 'u1', name: 'Old Roommate', joinedAt: '2026-01-01', status: 'active' },
        { userId: 'u2', name: 'New Roommate', joinedAt: '2026-11-15', status: 'active' },
      ];

      const stmt = calculateSettlement({
        roomId: 'r1',
        period: '2026-11',
        monthlyRentPaise: 2000000,
        members,
        expenses: [],
      });

      // Both pay 50% of monthly rent
      const newMember = stmt.memberStatements.find((m) => m.userId === 'u2')!;
      expect(newMember.rentSharePaise).toBe(1000000);
    });

    it('includes a departed roommate up to departure date for expenses and rent during active period', () => {
      const members: SettlementMemberInput[] = [
        { userId: 'u1', name: 'Staying', joinedAt: '2026-01-01', status: 'active' },
        {
          userId: 'u2',
          name: 'Leaving Mid-Month',
          joinedAt: '2026-01-01',
          departedAt: '2026-11-10',
          status: 'departed',
        },
      ];

      const expenses: SettlementExpenseInput[] = [
        // Occurred on Nov 5 (before departure) -> split with departed member
        {
          id: 'exp-early',
          name: 'Early Nov groceries',
          amountPaise: 100000,
          paidByUserId: 'u1',
          expenseDate: '2026-11-05',
          expensePeriod: '2026-11',
          settlementPreference: 'monthly',
        },
        // Occurred on Nov 25 (after departure) -> departed member not included in shares
        {
          id: 'exp-late',
          name: 'Late Nov groceries',
          amountPaise: 50000,
          paidByUserId: 'u1',
          expenseDate: '2026-11-25',
          expensePeriod: '2026-11',
          settlementPreference: 'monthly',
          shares: [{ userId: 'u1', sharePaise: 50000 }],
        },
      ];

      const stmt = calculateSettlement({
        roomId: 'r1',
        period: '2026-11',
        monthlyRentPaise: 2000000,
        members,
        expenses,
      });

      const departed = stmt.memberStatements.find((m) => m.userId === 'u2')!;
      expect(departed.status).toBe('departed');
      // Departed member share only for the early expense (50,000 paise)
      expect(departed.expenseSharePaise).toBe(50000);
    });
  });

  // -------------------------------------------------------------
  // 7. Post-Finalization Adjustments
  // -------------------------------------------------------------
  describe('Post-Finalization Adjustments', () => {
    it('applies post-finalization adjustment lines to the current period', () => {
      const members: SettlementMemberInput[] = [
        { userId: 'u1', name: 'Rahul', joinedAt: '2026-01-01', status: 'active' },
        { userId: 'u2', name: 'Aman', joinedAt: '2026-01-01', status: 'active' },
      ];

      const stmt = calculateSettlement({
        roomId: 'r1',
        period: '2026-11',
        monthlyRentPaise: 2000000,
        members,
        expenses: [],
        postFinalizationAdjustments: [
          {
            id: 'adj-1',
            description: 'BESCOM corrected meter reading adjustment',
            amountPaise: -25000, // ₹250 refund / credit
            userId: 'u1',
            originalPeriod: '2026-10',
          },
        ],
      });

      expect(stmt.totalAdjustmentsPaise).toBe(-25000);
      const rahul = stmt.memberStatements.find((m) => m.userId === 'u1')!;
      expect(rahul.adjustmentPaise).toBe(-25000);
      expect(rahul.totalSharePaise).toBe(1000000 - 25000); // 975,000 paise
    });
  });

  // -------------------------------------------------------------
  // 8. Immediate Settlement Exclusion
  // -------------------------------------------------------------
  describe('Settle Immediately Exclusion', () => {
    it('strictly excludes settlementPreference=immediate expenses from monthly cycle', () => {
      const members: SettlementMemberInput[] = [
        { userId: 'u1', name: 'Rahul', joinedAt: '2026-01-01', status: 'active' },
        { userId: 'u2', name: 'Aman', joinedAt: '2026-01-01', status: 'active' },
      ];

      const expenses: SettlementExpenseInput[] = [
        {
          id: 'exp-monthly',
          name: 'Monthly Gas Cylinder',
          amountPaise: 110000,
          paidByUserId: 'u1',
          expenseDate: '2026-11-10',
          expensePeriod: '2026-11',
          settlementPreference: 'monthly',
        },
        {
          id: 'exp-immediate',
          name: 'Swiggy Dinner Instant Split',
          amountPaise: 80000,
          paidByUserId: 'u2',
          expenseDate: '2026-11-12',
          expensePeriod: '2026-11',
          settlementPreference: 'immediate', // Excluded from monthly cycle!
        },
      ];

      const stmt = calculateSettlement({
        roomId: 'r1',
        period: '2026-11',
        monthlyRentPaise: 2000000,
        members,
        expenses,
      });

      expect(stmt.totalExpensesPaise).toBe(110000); // Only gas cylinder included
      expect(stmt.lineItems.find((l) => l.name === 'Swiggy Dinner Instant Split')).toBeUndefined();
    });
  });

  // -------------------------------------------------------------
  // 9. Edge Cases (Single member, zero expenses, very large & small amounts)
  // -------------------------------------------------------------
  describe('Edge Cases', () => {
    it('handles single-member room', () => {
      const members: SettlementMemberInput[] = [
        { userId: 'u1', name: 'Solo Occupant', joinedAt: '2026-01-01', status: 'active' },
      ];

      const stmt = calculateSettlement({
        roomId: 'solo-flat',
        period: '2026-11',
        monthlyRentPaise: 1500000,
        members,
        expenses: [
          {
            id: 'e1',
            name: 'Wi-Fi',
            amountPaise: 99900,
            paidByUserId: 'u1',
            expenseDate: '2026-11-01',
            expensePeriod: '2026-11',
            settlementPreference: 'monthly',
          },
        ],
      });

      expect(stmt.memberStatements).toHaveLength(1);
      const solo = stmt.memberStatements[0];
      expect(solo.rentSharePaise).toBe(1500000);
      expect(solo.expenseSharePaise).toBe(99900);
      expect(solo.expensePaidPaise).toBe(99900);
      // Net owed is only the rent since they paid their own expense upfront
      expect(solo.netAmountOwedPaise).toBe(1500000);
    });

    it('handles zero expenses in the month', () => {
      const members: SettlementMemberInput[] = [
        { userId: 'u1', name: 'Rahul', joinedAt: '2026-01-01', status: 'active' },
        { userId: 'u2', name: 'Aman', joinedAt: '2026-01-01', status: 'active' },
      ];

      const stmt = calculateSettlement({
        roomId: 'r1',
        period: '2026-11',
        monthlyRentPaise: 2000000,
        members,
        expenses: [],
      });

      expect(stmt.totalExpensesPaise).toBe(0);
      expect(stmt.grandTotalPaise).toBe(2000000);
      for (const m of stmt.memberStatements) {
        expect(m.expenseSharePaise).toBe(0);
        expect(m.netAmountOwedPaise).toBe(1000000);
      }
    });

    it('handles very large amounts (₹15,00,000 / 150,000,000 paise)', () => {
      const members: SettlementMemberInput[] = [
        { userId: 'u1', name: 'Rahul', joinedAt: '2026-01-01', status: 'active' },
        { userId: 'u2', name: 'Aman', joinedAt: '2026-01-01', status: 'active' },
        { userId: 'u3', name: 'Kunal', joinedAt: '2026-01-01', status: 'active' },
      ];

      const largeRent = 150000000; // ₹15 Lakhs
      const stmt = calculateSettlement({
        roomId: 'r1',
        period: '2026-11',
        monthlyRentPaise: largeRent,
        members,
        expenses: [],
      });

      expect(stmt.totalRentPaise).toBe(largeRent);
      const sum = stmt.memberStatements.reduce((acc, m) => acc + m.rentSharePaise, 0);
      expect(sum).toBe(largeRent);
      expect(stmt.memberStatements[0].rentSharePaise).toBe(50000000);
    });

    it('handles very small amount (₹1 / 100 paise) across 3 members', () => {
      const members: SettlementMemberInput[] = [
        { userId: 'u1', name: 'Rahul', joinedAt: '2026-01-01', status: 'active' },
        { userId: 'u2', name: 'Aman', joinedAt: '2026-01-01', status: 'active' },
        { userId: 'u3', name: 'Kunal', joinedAt: '2026-01-01', status: 'active' },
      ];

      const stmt = calculateSettlement({
        roomId: 'r1',
        period: '2026-11',
        monthlyRentPaise: 0,
        members,
        expenses: [
          {
            id: 'matchbox',
            name: 'Matchbox',
            amountPaise: 100, // ₹1
            paidByUserId: 'u1',
            expenseDate: '2026-11-01',
            expensePeriod: '2026-11',
            settlementPreference: 'monthly',
          },
        ],
      });

      expect(stmt.totalExpensesPaise).toBe(100);
      const sum = stmt.memberStatements.reduce((acc, m) => acc + m.expenseSharePaise, 0);
      expect(sum).toBe(100);
      // 34 + 33 + 33 = 100
      expect(stmt.memberStatements[0].expenseSharePaise).toBe(34);
      expect(stmt.memberStatements[1].expenseSharePaise).toBe(33);
      expect(stmt.memberStatements[2].expenseSharePaise).toBe(33);
    });

    it('strictly satisfies the Net Settlement Invariant: sum(netAmountOwedPaise) === totalRent + totalCarriedForward + totalAdjustments', () => {
      const members: SettlementMemberInput[] = [
        { userId: 'u1', name: 'Rahul', joinedAt: '2026-01-01', status: 'active' },
        { userId: 'u2', name: 'Aman', joinedAt: '2026-01-01', status: 'active' },
        { userId: 'u3', name: 'Kunal', joinedAt: '2026-01-01', status: 'active' },
        { userId: 'u4', name: 'Sameer', joinedAt: '2026-01-01', status: 'active' },
      ];

      const expenses: SettlementExpenseInput[] = [
        { id: 'e1', name: 'Rent Utilities', amountPaise: 54321, paidByUserId: 'u1', expenseDate: '2026-11-01', expensePeriod: '2026-11', settlementPreference: 'monthly' },
        { id: 'e2', name: 'Food', amountPaise: 98765, paidByUserId: 'u2', expenseDate: '2026-11-05', expensePeriod: '2026-11', settlementPreference: 'monthly' },
        { id: 'e3', name: 'Cleaning', amountPaise: 12345, paidByUserId: 'u3', expenseDate: '2026-11-10', expensePeriod: '2026-11', settlementPreference: 'monthly' },
      ];

      const stmt = calculateSettlement({
        roomId: 'r1',
        period: '2026-11',
        monthlyRentPaise: 2800000,
        members,
        expenses,
        carriedForwardItems: [
          { id: 'cf1', description: 'Prev month late fee', amountPaise: 15000, userId: 'u4', originalPeriod: '2026-10' },
        ],
        postFinalizationAdjustments: [
          { id: 'adj1', description: 'Overcharge correction', amountPaise: -5000, userId: 'u2', originalPeriod: '2026-10' },
        ],
      });

      const totalNetOwed = stmt.memberStatements.reduce((acc, m) => acc + m.netAmountOwedPaise, 0);
      const expectedTotal = stmt.totalRentPaise + stmt.totalCarriedForwardPaise + stmt.totalAdjustmentsPaise;
      expect(totalNetOwed).toBe(expectedTotal);
    });
  });
});
