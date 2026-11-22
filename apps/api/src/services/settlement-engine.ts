/**
 * Pure TypeScript Settlement Calculation Engine for PG Expense Manager
 *
 * Implements strict integer paise arithmetic, deterministic remainder allocation,
 * rent + expense aggregation, multi-month bill assignment, carried-forward adjustments,
 * and per-roommate net settlement statement computation.
 */

export interface SettlementMemberInput {
  userId: string;
  name: string;
  joinedAt: string; // ISO date string or YYYY-MM-DD
  departedAt?: string | null;
  status: 'active' | 'departed';
}

export interface SettlementExpenseInput {
  id: string;
  name: string;
  amountPaise: number;
  paidByUserId: string;
  expenseDate: string; // YYYY-MM-DD
  expensePeriod: string; // YYYY-MM
  billingPeriodStart?: string | null;
  billingPeriodEnd?: string | null;
  settlementPreference: 'monthly' | 'immediate';
  shares?: { userId: string; sharePaise: number }[];
  deletedAt?: string | null;
}

export interface CarriedForwardItem {
  id: string;
  description: string;
  amountPaise: number; // positive = owes, negative = credit
  userId: string;
  originalPeriod: string;
}

export interface PostFinalizationAdjustment {
  id: string;
  description: string;
  amountPaise: number;
  userId: string;
  originalPeriod: string;
}

export interface SettlementCalculationInput {
  roomId: string;
  period: string; // YYYY-MM
  monthlyRentPaise: number;
  members: SettlementMemberInput[];
  expenses: SettlementExpenseInput[];
  carriedForwardItems?: CarriedForwardItem[];
  postFinalizationAdjustments?: PostFinalizationAdjustment[];
}

export interface SettlementLineItem {
  id: string;
  type: 'rent' | 'expense' | 'carried_forward' | 'adjustment';
  name: string;
  category?: string;
  totalAmountPaise: number;
  paidByUserId?: string;
  paidByName?: string;
  billingPeriod?: string;
  memberShares: { userId: string; sharePaise: number }[];
}

export interface SettlementMemberStatement {
  userId: string;
  name: string;
  status: 'active' | 'departed';
  rentSharePaise: number;
  expenseSharePaise: number;
  expensePaidPaise: number;
  carriedForwardPaise: number;
  adjustmentPaise: number;
  totalSharePaise: number; // rentShare + expenseShare + carriedForward + adjustment
  netAmountOwedPaise: number; // totalSharePaise - expensePaidPaise (> 0 means owes collector, < 0 means refund/credit)
}

export interface SettlementStatement {
  roomId: string;
  period: string; // YYYY-MM
  totalRentPaise: number;
  totalExpensesPaise: number;
  totalCarriedForwardPaise: number;
  totalAdjustmentsPaise: number;
  grandTotalPaise: number;
  memberCount: number;
  lineItems: SettlementLineItem[];
  memberStatements: SettlementMemberStatement[];
}

/**
 * Deterministically splits totalPaise among memberUserIds.
 * Sorts memberUserIds alphabetically so the exact same allocation is always reproduced.
 * Remainder paise are awarded +1 to the first 'remainder' members.
 * Guarantees sum(shares) === totalPaise down to 0 paise difference.
 */
export function calculateEqualPaiseShares(
  totalPaise: number,
  memberUserIds: string[]
): { userId: string; sharePaise: number }[] {
  if (memberUserIds.length === 0) return [];
  if (totalPaise <= 0) {
    return memberUserIds.map((userId) => ({ userId, sharePaise: 0 }));
  }

  const sortedIds = [...memberUserIds].sort();
  const count = sortedIds.length;
  const baseShare = Math.floor(totalPaise / count);
  const remainder = totalPaise % count;

  return sortedIds.map((userId, index) => ({
    userId,
    sharePaise: baseShare + (index < remainder ? 1 : 0),
  }));
}

/**
 * Core Settlement Engine
 */
export function calculateSettlement(input: SettlementCalculationInput): SettlementStatement {
  const {
    roomId,
    period,
    monthlyRentPaise,
    members,
    expenses,
    carriedForwardItems = [],
    postFinalizationAdjustments = [],
  } = input;

  // 1. Identify members eligible for rent and expenses during this period (YYYY-MM)
  // Period start and end boundaries (e.g. '2026-11-01' to '2026-11-30')
  const [yearStr, monthStr] = period.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const lastDay = new Date(year, month, 0).getDate();
  const periodStart = `${period}-01`;
  const periodEnd = `${period}-${lastDay.toString().padStart(2, '0')}`;

  // Rent eligibility: active members who joined on or before periodEnd and did not depart before periodStart
  const eligibleRentMembers = members.filter((m) => {
    const joined = m.joinedAt.slice(0, 10);
    if (joined > periodEnd) return false;
    if (m.departedAt) {
      const departed = m.departedAt.slice(0, 10);
      if (departed < periodStart) return false;
    }
    return true;
  });

  const rentMemberIds = eligibleRentMembers.map((m) => m.userId);

  // 2. Compute Rent Shares
  const rentShares = calculateEqualPaiseShares(monthlyRentPaise, rentMemberIds);
  const rentShareMap = new Map(rentShares.map((s) => [s.userId, s.sharePaise]));

  const lineItems: SettlementLineItem[] = [];

  if (monthlyRentPaise > 0 && rentMemberIds.length > 0) {
    lineItems.push({
      id: `rent-${period}`,
      type: 'rent',
      name: `Flat Monthly Rent (${period})`,
      totalAmountPaise: monthlyRentPaise,
      memberShares: rentShares,
    });
  }

  // 3. Filter and Aggregate Monthly Expenses
  // Exclude soft-deleted expenses and expenses marked for immediate settlement
  const eligibleExpenses = expenses.filter((e) => {
    if (e.deletedAt) return false;
    if (e.settlementPreference === 'immediate') return false;

    // Check if expense belongs to this settlement period
    if (e.expensePeriod === period) return true;

    // Fallback: match expenseDate within month if period not explicitly specified
    if (!e.expensePeriod && e.expenseDate.startsWith(period)) return true;

    return false;
  });

  // Track each member's expense share and paid upfront amounts
  const memberExpenseShareMap = new Map<string, number>();
  const memberExpensePaidMap = new Map<string, number>();

  // Initialize maps for all members
  for (const m of members) {
    memberExpenseShareMap.set(m.userId, 0);
    memberExpensePaidMap.set(m.userId, 0);
  }

  let totalExpensesPaise = 0;

  for (const exp of eligibleExpenses) {
    totalExpensesPaise += exp.amountPaise;

    // Record upfront payment by payer
    const currentPaid = memberExpensePaidMap.get(exp.paidByUserId) || 0;
    memberExpensePaidMap.set(exp.paidByUserId, currentPaid + exp.amountPaise);

    // Determine expense shares
    let shares = exp.shares;
    if (!shares || shares.length === 0) {
      // Calculate equal shares across members present on expenseDate
      const activeOnDate = members.filter((m) => {
        const joined = m.joinedAt.slice(0, 10);
        if (joined > exp.expenseDate) return false;
        if (m.departedAt) {
          const departed = m.departedAt.slice(0, 10);
          if (departed < exp.expenseDate) return false;
        }
        return true;
      });

      const ids = activeOnDate.length > 0 ? activeOnDate.map((m) => m.userId) : rentMemberIds;
      shares = calculateEqualPaiseShares(exp.amountPaise, ids);
    }

    // Accumulate each member's share
    for (const s of shares) {
      const cur = memberExpenseShareMap.get(s.userId) || 0;
      memberExpenseShareMap.set(s.userId, cur + s.sharePaise);
    }

    lineItems.push({
      id: exp.id,
      type: 'expense',
      name: exp.name,
      totalAmountPaise: exp.amountPaise,
      paidByUserId: exp.paidByUserId,
      paidByName: members.find((m) => m.userId === exp.paidByUserId)?.name,
      billingPeriod: exp.billingPeriodStart && exp.billingPeriodEnd
        ? `${exp.billingPeriodStart} to ${exp.billingPeriodEnd}`
        : undefined,
      memberShares: shares,
    });
  }

  // 4. Carried Forward Items (from previous missing bills / carried balances)
  const memberCarriedForwardMap = new Map<string, number>();
  for (const m of members) memberCarriedForwardMap.set(m.userId, 0);

  let totalCarriedForwardPaise = 0;
  for (const item of carriedForwardItems) {
    totalCarriedForwardPaise += item.amountPaise;
    const cur = memberCarriedForwardMap.get(item.userId) || 0;
    memberCarriedForwardMap.set(item.userId, cur + item.amountPaise);

    lineItems.push({
      id: item.id,
      type: 'carried_forward',
      name: `Carried Forward: ${item.description} (${item.originalPeriod})`,
      totalAmountPaise: item.amountPaise,
      memberShares: [{ userId: item.userId, sharePaise: item.amountPaise }],
    });
  }

  // 5. Post-Finalization Adjustments (corrections from previously finalized settlements)
  const memberAdjustmentsMap = new Map<string, number>();
  for (const m of members) memberAdjustmentsMap.set(m.userId, 0);

  let totalAdjustmentsPaise = 0;
  for (const adj of postFinalizationAdjustments) {
    totalAdjustmentsPaise += adj.amountPaise;
    const cur = memberAdjustmentsMap.get(adj.userId) || 0;
    memberAdjustmentsMap.set(adj.userId, cur + adj.amountPaise);

    lineItems.push({
      id: adj.id,
      type: 'adjustment',
      name: `Adjustment: ${adj.description} (${adj.originalPeriod})`,
      totalAmountPaise: adj.amountPaise,
      memberShares: [{ userId: adj.userId, sharePaise: adj.amountPaise }],
    });
  }

  // 6. Build Per-Member Statement
  const memberStatements: SettlementMemberStatement[] = [];

  // Include all eligible members (and any departed members with outstanding balance)
  const relevantMembers = members.filter((m) => {
    if (rentMemberIds.includes(m.userId)) return true;
    if ((memberExpenseShareMap.get(m.userId) || 0) > 0) return true;
    if ((memberExpensePaidMap.get(m.userId) || 0) > 0) return true;
    if ((memberCarriedForwardMap.get(m.userId) || 0) !== 0) return true;
    if ((memberAdjustmentsMap.get(m.userId) || 0) !== 0) return true;
    return false;
  });

  for (const m of relevantMembers) {
    const rentShare = rentShareMap.get(m.userId) || 0;
    const expenseShare = memberExpenseShareMap.get(m.userId) || 0;
    const expensePaid = memberExpensePaidMap.get(m.userId) || 0;
    const carriedForward = memberCarriedForwardMap.get(m.userId) || 0;
    const adjustment = memberAdjustmentsMap.get(m.userId) || 0;

    const totalSharePaise = rentShare + expenseShare + carriedForward + adjustment;
    // Net owed = what the member is obligated for minus what they already paid upfront
    const netAmountOwedPaise = totalSharePaise - expensePaid;

    memberStatements.push({
      userId: m.userId,
      name: m.name,
      status: m.status,
      rentSharePaise: rentShare,
      expenseSharePaise: expenseShare,
      expensePaidPaise: expensePaid,
      carriedForwardPaise: carriedForward,
      adjustmentPaise: adjustment,
      totalSharePaise,
      netAmountOwedPaise,
    });
  }

  const grandTotalPaise = monthlyRentPaise + totalExpensesPaise + totalCarriedForwardPaise + totalAdjustmentsPaise;

  return {
    roomId,
    period,
    totalRentPaise: monthlyRentPaise,
    totalExpensesPaise,
    totalCarriedForwardPaise,
    totalAdjustmentsPaise,
    grandTotalPaise,
    memberCount: relevantMembers.length,
    lineItems,
    memberStatements,
  };
}
