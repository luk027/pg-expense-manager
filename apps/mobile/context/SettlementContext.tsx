import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useRoom } from './RoomContext';
import { useExpenses } from './ExpenseContext';

export interface SettlementLineItem {
  id: string;
  type: 'rent' | 'expense' | 'carried_forward' | 'adjustment';
  name: string;
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
  totalSharePaise: number;
  netAmountOwedPaise: number;
}

export interface SettlementStatementData {
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

export interface SettlementRecord {
  id: string;
  roomId: string;
  period: string;
  status: 'draft' | 'finalized';
  finalizedByUserId?: string | null;
  finalizedByName?: string | null;
  finalizedAt?: string | null;
  totalRentPaise: number;
  totalExpensesPaise: number;
  totalCarriedForwardPaise: number;
  totalAdjustmentsPaise: number;
  grandTotalPaise: number;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SettlementMemberShareItem {
  id: string;
  settlementId: string;
  userId: string;
  userName: string;
  rentSharePaise: number;
  expenseSharePaise: number;
  carriedForwardPaise: number;
  adjustmentPaise: number;
  totalSharePaise: number;
  expensePaidPaise: number;
  amountOwedPaise: number;
  amountPaidPaise: number;
}

interface SettlementContextType {
  settlement: SettlementRecord | null;
  statement: SettlementStatementData | null;
  memberShares: SettlementMemberShareItem[];
  settlementsList: SettlementRecord[];
  selectedPeriod: string;
  setSelectedPeriod: (period: string) => void;
  isFinalized: boolean;
  isLoading: boolean;
  refreshSettlement: () => Promise<void>;
  finalizeSettlement: () => Promise<{ success: boolean; error?: string }>;
}

const SettlementContext = createContext<SettlementContextType | undefined>(undefined);
const API_URL = 'http://192.168.113.107:8787';

// Generate dynamic draft statement for offline fallback
function computeLocalStatement(
  roomId: string,
  period: string,
  rentPaise: number,
  roomMembers: { userId: string; name: string }[],
  roomExpenses: any[]
): SettlementStatementData {
  const memberCount = Math.max(roomMembers.length, 1);
  const baseRentShare = Math.floor(rentPaise / memberCount);
  const rentRemainder = rentPaise % memberCount;

  const sortedMembers = [...roomMembers].sort((a, b) => a.userId.localeCompare(b.userId));

  const rentShares = sortedMembers.map((m, idx) => ({
    userId: m.userId,
    sharePaise: baseRentShare + (idx < rentRemainder ? 1 : 0),
  }));

  const lineItems: SettlementLineItem[] = [];

  if (rentPaise > 0) {
    lineItems.push({
      id: `rent-${period}`,
      type: 'rent',
      name: `Flat Monthly Rent (${period})`,
      totalAmountPaise: rentPaise,
      memberShares: rentShares,
    });
  }

  // Filter expenses for this period
  const periodExpenses = roomExpenses.filter(
    (e) => e.expensePeriod === period && e.settlementPreference !== 'immediate'
  );

  const memberExpenseShareMap = new Map<string, number>();
  const memberExpensePaidMap = new Map<string, number>();
  for (const m of sortedMembers) {
    memberExpenseShareMap.set(m.userId, 0);
    memberExpensePaidMap.set(m.userId, 0);
  }

  let totalExpensesPaise = 0;
  for (const exp of periodExpenses) {
    totalExpensesPaise += exp.amountPaise;
    const curPaid = memberExpensePaidMap.get(exp.paidByUserId) || 0;
    memberExpensePaidMap.set(exp.paidByUserId, curPaid + exp.amountPaise);

    const baseExpShare = Math.floor(exp.amountPaise / memberCount);
    const expRemainder = exp.amountPaise % memberCount;
    const expShares = sortedMembers.map((m, idx) => ({
      userId: m.userId,
      sharePaise: baseExpShare + (idx < expRemainder ? 1 : 0),
    }));

    for (const s of expShares) {
      const cur = memberExpenseShareMap.get(s.userId) || 0;
      memberExpenseShareMap.set(s.userId, cur + s.sharePaise);
    }

    lineItems.push({
      id: exp.id,
      type: 'expense',
      name: exp.name,
      totalAmountPaise: exp.amountPaise,
      paidByUserId: exp.paidByUserId,
      paidByName: exp.paidByName,
      billingPeriod: exp.billingPeriodStart && exp.billingPeriodEnd
        ? `${exp.billingPeriodStart} to ${exp.billingPeriodEnd}`
        : undefined,
      memberShares: expShares,
    });
  }

  const memberStatements: SettlementMemberStatement[] = sortedMembers.map((m) => {
    const rShare = rentShares.find((s) => s.userId === m.userId)?.sharePaise || 0;
    const eShare = memberExpenseShareMap.get(m.userId) || 0;
    const ePaid = memberExpensePaidMap.get(m.userId) || 0;
    const totalShare = rShare + eShare;
    const netOwed = totalShare - ePaid;

    return {
      userId: m.userId,
      name: m.name,
      status: 'active',
      rentSharePaise: rShare,
      expenseSharePaise: eShare,
      expensePaidPaise: ePaid,
      carriedForwardPaise: 0,
      adjustmentPaise: 0,
      totalSharePaise: totalShare,
      netAmountOwedPaise: netOwed,
    };
  });

  return {
    roomId,
    period,
    totalRentPaise: rentPaise,
    totalExpensesPaise,
    totalCarriedForwardPaise: 0,
    totalAdjustmentsPaise: 0,
    grandTotalPaise: rentPaise + totalExpensesPaise,
    memberCount: sortedMembers.length,
    lineItems,
    memberStatements,
  };
}

export function SettlementProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const { room, activeMembers } = useRoom();
  const { expenses } = useExpenses();

  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026-11');
  const [settlement, setSettlement] = useState<SettlementRecord | null>(null);
  const [statement, setStatement] = useState<SettlementStatementData | null>(null);
  const [memberShares, setMemberShares] = useState<SettlementMemberShareItem[]>([]);
  const [settlementsList, setSettlementsList] = useState<SettlementRecord[]>([]);
  const [isFinalized, setIsFinalized] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Compute local fallback for period
  const applyLocalFallback = useCallback(() => {
    if (!room?.id) return;

    // October 2026 (Historical Finalized)
    if (selectedPeriod === '2026-10') {
      const octSettlement: SettlementRecord = {
        id: 'oct-local-finalized',
        roomId: room.id,
        period: '2026-10',
        status: 'finalized',
        finalizedByUserId: 'u1111111-1111-1111-1111-111111111111',
        finalizedByName: 'Rahul Sharma',
        finalizedAt: '2026-10-31T20:00:00Z',
        totalRentPaise: 2800000,
        totalExpensesPaise: 360000,
        totalCarriedForwardPaise: 0,
        totalAdjustmentsPaise: 0,
        grandTotalPaise: 3160000,
        memberCount: 4,
        createdAt: '2026-10-31T20:00:00Z',
        updatedAt: '2026-10-31T20:00:00Z',
      };

      setSettlement(octSettlement);
      setIsFinalized(true);

      const octStatement = computeLocalStatement(
        room.id,
        '2026-10',
        2800000,
        activeMembers.map((m) => ({ userId: m.userId, name: m.name })),
        [
          {
            id: 'e1005',
            name: 'BESCOM Electricity Bill (Sep-Oct)',
            amountPaise: 360000,
            paidByUserId: 'u1111111-1111-1111-1111-111111111111',
            paidByName: 'Rahul Sharma',
            expensePeriod: '2026-10',
            billingPeriodStart: '2026-09-01',
            billingPeriodEnd: '2026-10-31',
            settlementPreference: 'monthly',
          },
        ]
      );
      setStatement(octStatement);

      const octShares: SettlementMemberShareItem[] = octStatement.memberStatements.map((m) => ({
        id: `share-${m.userId}`,
        settlementId: octSettlement.id,
        userId: m.userId,
        userName: m.name,
        rentSharePaise: m.rentSharePaise,
        expenseSharePaise: m.expenseSharePaise,
        carriedForwardPaise: 0,
        adjustmentPaise: 0,
        totalSharePaise: m.totalSharePaise,
        expensePaidPaise: m.expensePaidPaise,
        amountOwedPaise: m.netAmountOwedPaise,
        amountPaidPaise: m.netAmountOwedPaise, // October is marked fully paid
      }));
      setMemberShares(octShares);
      return;
    }

    // November 2026 (Live Draft)
    const members = activeMembers.length > 0
      ? activeMembers.map((m) => ({ userId: m.userId, name: m.name }))
      : [
          { userId: 'u1111111-1111-1111-1111-111111111111', name: 'Rahul Sharma' },
          { userId: 'u2222222-2222-2222-2222-222222222222', name: 'Aman Verma' },
          { userId: 'u3333333-3333-3333-3333-333333333333', name: 'Kunal Patel' },
          { userId: 'u4444444-4444-4444-4444-444444444444', name: 'Sameer Rao' },
        ];

    const localStmt = computeLocalStatement(
      room.id,
      selectedPeriod,
      room.monthlyRentPaise || 2800000,
      members,
      expenses
    );

    const draftRecord: SettlementRecord = {
      id: `draft-${room.id}-${selectedPeriod}`,
      roomId: room.id,
      period: selectedPeriod,
      status: 'draft',
      totalRentPaise: localStmt.totalRentPaise,
      totalExpensesPaise: localStmt.totalExpensesPaise,
      totalCarriedForwardPaise: localStmt.totalCarriedForwardPaise,
      totalAdjustmentsPaise: localStmt.totalAdjustmentsPaise,
      grandTotalPaise: localStmt.grandTotalPaise,
      memberCount: localStmt.memberCount,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setSettlement(draftRecord);
    setStatement(localStmt);
    setIsFinalized(false);

    const draftShares: SettlementMemberShareItem[] = localStmt.memberStatements.map((m) => ({
      id: `draft-share-${m.userId}`,
      settlementId: draftRecord.id,
      userId: m.userId,
      userName: m.name,
      rentSharePaise: m.rentSharePaise,
      expenseSharePaise: m.expenseSharePaise,
      carriedForwardPaise: 0,
      adjustmentPaise: 0,
      totalSharePaise: m.totalSharePaise,
      expensePaidPaise: m.expensePaidPaise,
      amountOwedPaise: m.netAmountOwedPaise,
      amountPaidPaise: 0,
    }));
    setMemberShares(draftShares);
  }, [room, selectedPeriod, activeMembers, expenses]);

  const refreshSettlement = useCallback(async () => {
    if (!room?.id) {
      setIsLoading(false);
      return;
    }

    try {
      // 1. Fetch list of settlements
      if (token) {
        const listRes = await fetch(`${API_URL}/api/rooms/${room.id}/settlements`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (listRes.ok) {
          const listData = await listRes.json();
          if (listData.settlements) {
            setSettlementsList(listData.settlements);
          }
        }

        // 2. Fetch specific period details
        const detailRes = await fetch(`${API_URL}/api/rooms/${room.id}/settlements/${selectedPeriod}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (detailRes.ok) {
          const detailData = await detailRes.json();
          setSettlement(detailData.settlement);
          setIsFinalized(Boolean(detailData.isFinalized));
          if (detailData.memberShares) {
            setMemberShares(detailData.memberShares);
          }
        }

        // 3. Fetch full statement
        const stmtRes = await fetch(`${API_URL}/api/rooms/${room.id}/settlements/${selectedPeriod}/statement`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (stmtRes.ok) {
          const stmtData = await stmtRes.json();
          if (stmtData.statement) {
            setStatement(stmtData.statement);
          }
        }
      } else {
        applyLocalFallback();
      }
    } catch {
      applyLocalFallback();
    } finally {
      setIsLoading(false);
    }
  }, [token, room?.id, selectedPeriod, applyLocalFallback]);

  useEffect(() => {
    refreshSettlement();
  }, [refreshSettlement]);

  const finalizeSettlement = async () => {
    if (!room?.id) return { success: false, error: 'No active room' };

    if (token) {
      try {
        const res = await fetch(`${API_URL}/api/rooms/${room.id}/settlements/${selectedPeriod}/finalize`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();
        if (res.ok) {
          await refreshSettlement();
          return { success: true };
        } else {
          return { success: false, error: data.error || 'Failed to finalize' };
        }
      } catch {
        // Fall through to offline finalization
      }
    }

    // Offline finalization simulation
    if (settlement) {
      const finalized = {
        ...settlement,
        status: 'finalized' as const,
        finalizedByUserId: user?.id || 'u1111111-1111-1111-1111-111111111111',
        finalizedByName: user?.name || 'Rahul Sharma',
        finalizedAt: new Date().toISOString(),
      };
      setSettlement(finalized);
      setIsFinalized(true);
      return { success: true };
    }

    return { success: false, error: 'Settlement record not available' };
  };

  return (
    <SettlementContext.Provider
      value={{
        settlement,
        statement,
        memberShares,
        settlementsList,
        selectedPeriod,
        setSelectedPeriod,
        isFinalized,
        isLoading,
        refreshSettlement,
        finalizeSettlement,
      }}
    >
      {children}
    </SettlementContext.Provider>
  );
}

export function useSettlement() {
  const context = useContext(SettlementContext);
  if (!context) {
    throw new Error('useSettlement must be used within a SettlementProvider');
  }
  return context;
}
