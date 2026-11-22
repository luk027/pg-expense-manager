import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useRoom } from './RoomContext';

export interface ExpenseShare {
  id: string;
  expenseId: string;
  userId: string;
  userName: string;
  sharePaise: number;
}

export interface ExpenseItem {
  id: string;
  roomId: string;
  name: string;
  amountPaise: number;
  categoryId: string;
  categoryName: string;
  paidByUserId: string;
  paidByName: string;
  expenseDate: string; // YYYY-MM-DD
  expensePeriod: string; // YYYY-MM
  settlementPeriod?: string | null;
  billingPeriodStart?: string | null;
  billingPeriodEnd?: string | null;
  settlementPreference: 'monthly' | 'immediate';
  shares: ExpenseShare[];
  createdAt: string;
  updatedAt: string;
}

export interface AddExpenseInput {
  name: string;
  amountPaise: number;
  categoryId: string;
  paidByUserId: string;
  expenseDate: string;
  settlementPreference?: 'monthly' | 'immediate';
  billingPeriodStart?: string | null;
  billingPeriodEnd?: string | null;
}

export interface UpdateExpenseInput {
  name?: string;
  amountPaise?: number;
  categoryId?: string;
  paidByUserId?: string;
  expenseDate?: string;
  settlementPreference?: 'monthly' | 'immediate';
  billingPeriodStart?: string | null;
  billingPeriodEnd?: string | null;
}

interface ExpenseContextType {
  expenses: ExpenseItem[];
  selectedPeriod: string;
  setSelectedPeriod: (period: string) => void;
  selectedCategory: string | null;
  setSelectedCategory: (catId: string | null) => void;
  totalAmountPaise: number;
  isLoading: boolean;
  refreshExpenses: () => Promise<void>;
  addExpense: (input: AddExpenseInput) => Promise<{ success: boolean; error?: string; expense?: ExpenseItem }>;
  updateExpense: (expenseId: string, input: UpdateExpenseInput) => Promise<{ success: boolean; error?: string }>;
  deleteExpense: (expenseId: string) => Promise<{ success: boolean; error?: string }>;
  getExpenseById: (id: string) => ExpenseItem | undefined;
}

const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);
const API_URL = 'http://192.168.113.107:8787';

// Deterministic paise split helper for offline support
function calculateEqualPaiseShares(
  totalPaise: number,
  members: { id: string; name: string }[]
): ExpenseShare[] {
  if (members.length === 0) return [];
  const sorted = [...members].sort((a, b) => a.id.localeCompare(b.id));
  const count = sorted.length;
  const base = Math.floor(totalPaise / count);
  const remainder = totalPaise % count;

  return sorted.map((m, idx) => ({
    id: `share-${m.id}-${Date.now()}`,
    expenseId: '',
    userId: m.id,
    userName: m.name,
    sharePaise: base + (idx < remainder ? 1 : 0),
  }));
}

// Initial demo expenses matching Flat 302
function getInitialDemoExpenses(roomId: string): ExpenseItem[] {
  const RAHUL_ID = 'u1111111-1111-1111-1111-111111111111';
  const AMAN_ID = 'u2222222-2222-2222-2222-222222222222';
  const KUNAL_ID = 'u3333333-3333-3333-3333-333333333333';
  const SAMEER_ID = 'u4444444-4444-4444-4444-444444444444';

  const roomMates = [
    { id: RAHUL_ID, name: 'Rahul Sharma' },
    { id: AMAN_ID, name: 'Aman Verma' },
    { id: KUNAL_ID, name: 'Kunal Patel' },
    { id: SAMEER_ID, name: 'Sameer Rao' },
  ];

  const now = new Date().toISOString();

  const items = [
    {
      id: 'e1001-rent-nov',
      name: 'Flat Monthly Rent',
      amountPaise: 2800000,
      categoryId: 'c1',
      categoryName: 'Rent',
      paidByUserId: RAHUL_ID,
      paidByName: 'Rahul Sharma',
      expenseDate: '2026-11-01',
      expensePeriod: '2026-11',
      settlementPreference: 'monthly' as const,
    },
    {
      id: 'e1002-wifi-nov',
      name: 'Airtel Fiber Gigabit Wi-Fi',
      amountPaise: 119900,
      categoryId: 'c5',
      categoryName: 'Wi-Fi',
      paidByUserId: AMAN_ID,
      paidByName: 'Aman Verma',
      expenseDate: '2026-11-03',
      expensePeriod: '2026-11',
      settlementPreference: 'monthly' as const,
    },
    {
      id: 'e1003-groceries',
      name: 'Monthly Grocery Essentials (Blinkit)',
      amountPaise: 245000,
      categoryId: 'c3',
      categoryName: 'Groceries',
      paidByUserId: KUNAL_ID,
      paidByName: 'Kunal Patel',
      expenseDate: '2026-11-08',
      expensePeriod: '2026-11',
      settlementPreference: 'monthly' as const,
    },
    {
      id: 'e1004-water-cans',
      name: 'Bisleri 20L Water Cans (6 cans)',
      amountPaise: 48000,
      categoryId: 'c4',
      categoryName: 'Water',
      paidByUserId: SAMEER_ID,
      paidByName: 'Sameer Rao',
      expenseDate: '2026-11-12',
      expensePeriod: '2026-11',
      settlementPreference: 'monthly' as const,
    },
    {
      id: 'e1005-electricity-multimonth',
      name: 'BESCOM Electricity Bill (Sep-Oct)',
      amountPaise: 360000,
      categoryId: 'c2',
      categoryName: 'Electricity',
      paidByUserId: RAHUL_ID,
      paidByName: 'Rahul Sharma',
      expenseDate: '2026-11-15',
      expensePeriod: '2026-10', // Assigned to last billing month
      billingPeriodStart: '2026-09-01',
      billingPeriodEnd: '2026-10-31',
      settlementPreference: 'monthly' as const,
    },
  ];

  return items.map((item) => ({
    ...item,
    roomId,
    settlementPeriod: item.expensePeriod,
    shares: calculateEqualPaiseShares(item.amountPaise, roomMates).map((s) => ({
      ...s,
      expenseId: item.id,
    })),
    createdAt: now,
    updatedAt: now,
  }));
}

export function ExpenseProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const { room, activeMembers, categories } = useRoom();

  const [expensesList, setExpensesList] = useState<ExpenseItem[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026-11');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize demo data if in room
  useEffect(() => {
    if (room?.id) {
      setExpensesList(getInitialDemoExpenses(room.id));
    }
  }, [room?.id]);

  const refreshExpenses = useCallback(async () => {
    if (!token || !room?.id) {
      setIsLoading(false);
      return;
    }

    try {
      let url = `${API_URL}/api/rooms/${room.id}/expenses`;
      if (selectedPeriod) {
        url += `?period=${selectedPeriod}`;
      }
      if (selectedCategory) {
        url += `${selectedPeriod ? '&' : '?'}categoryId=${selectedCategory}`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.expenses && Array.isArray(data.expenses)) {
          setExpensesList(data.expenses);
        }
      }
    } catch {
      // Offline fallback: keep cached/demo list
    } finally {
      setIsLoading(false);
    }
  }, [token, room?.id, selectedPeriod, selectedCategory]);

  useEffect(() => {
    refreshExpenses();
  }, [refreshExpenses]);

  // Filtered expenses based on period and category
  const filteredExpenses = useMemo(() => {
    return expensesList.filter((e) => {
      const matchPeriod = selectedPeriod ? e.expensePeriod === selectedPeriod : true;
      const matchCategory = selectedCategory ? e.categoryId === selectedCategory : true;
      return matchPeriod && matchCategory;
    });
  }, [expensesList, selectedPeriod, selectedCategory]);

  const totalAmountPaise = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + e.amountPaise, 0);
  }, [filteredExpenses]);

  const addExpense = async (input: AddExpenseInput) => {
    if (!room?.id) return { success: false, error: 'No active room found' };

    const payer = activeMembers.find((m) => m.userId === input.paidByUserId) || {
      name: user?.name || 'Roommate',
      userId: input.paidByUserId,
    };
    const cat = categories.find((c) => c.id === input.categoryId);
    const categoryName = cat?.name || 'General';

    // Try online API first
    if (token) {
      try {
        const res = await fetch(`${API_URL}/api/rooms/${room.id}/expenses`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(input),
        });

        if (res.ok) {
          const data = await res.json();
          await refreshExpenses();
          return { success: true, expense: data.expense };
        }
      } catch {
        // Fall through to offline handling
      }
    }

    // Offline / Standalone Fallback
    const period = input.billingPeriodEnd ? input.billingPeriodEnd.slice(0, 7) : input.expenseDate.slice(0, 7);
    const newId = `exp-local-${Date.now()}`;
    const membersToSplit = activeMembers.length > 0
      ? activeMembers.map((m) => ({ id: m.userId, name: m.name }))
      : [{ id: input.paidByUserId, name: payer.name }];

    const shares = calculateEqualPaiseShares(input.amountPaise, membersToSplit).map((s) => ({
      ...s,
      expenseId: newId,
    }));

    const newExpense: ExpenseItem = {
      id: newId,
      roomId: room.id,
      name: input.name.trim(),
      amountPaise: input.amountPaise,
      categoryId: input.categoryId,
      categoryName,
      paidByUserId: input.paidByUserId,
      paidByName: payer.name,
      expenseDate: input.expenseDate,
      expensePeriod: period,
      settlementPeriod: period,
      billingPeriodStart: input.billingPeriodStart || null,
      billingPeriodEnd: input.billingPeriodEnd || null,
      settlementPreference: input.settlementPreference || 'monthly',
      shares,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setExpensesList((prev) => [newExpense, ...prev]);
    return { success: true, expense: newExpense };
  };

  const updateExpense = async (expenseId: string, input: UpdateExpenseInput) => {
    if (!room?.id) return { success: false, error: 'No active room found' };

    if (token) {
      try {
        const res = await fetch(`${API_URL}/api/rooms/${room.id}/expenses/${expenseId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(input),
        });

        if (res.ok) {
          await refreshExpenses();
          return { success: true };
        }
      } catch {
        // Fall through to offline update
      }
    }

    // Offline update
    setExpensesList((prev) =>
      prev.map((e) => {
        if (e.id !== expenseId) return e;

        const updatedAmount = input.amountPaise !== undefined ? input.amountPaise : e.amountPaise;
        const updatedDate = input.expenseDate || e.expenseDate;
        const updatedEnd = input.billingPeriodEnd !== undefined ? input.billingPeriodEnd : e.billingPeriodEnd;
        const updatedPeriod = updatedEnd ? updatedEnd.slice(0, 7) : updatedDate.slice(0, 7);

        const membersToSplit = activeMembers.length > 0
          ? activeMembers.map((m) => ({ id: m.userId, name: m.name }))
          : [{ id: e.paidByUserId, name: e.paidByName }];

        const updatedShares = input.amountPaise !== undefined && input.amountPaise !== e.amountPaise
          ? calculateEqualPaiseShares(updatedAmount, membersToSplit).map((s) => ({ ...s, expenseId }))
          : e.shares;

        return {
          ...e,
          name: input.name !== undefined ? input.name.trim() : e.name,
          amountPaise: updatedAmount,
          categoryId: input.categoryId || e.categoryId,
          paidByUserId: input.paidByUserId || e.paidByUserId,
          expenseDate: updatedDate,
          expensePeriod: updatedPeriod,
          billingPeriodStart: input.billingPeriodStart !== undefined ? input.billingPeriodStart : e.billingPeriodStart,
          billingPeriodEnd: updatedEnd,
          settlementPreference: input.settlementPreference || e.settlementPreference,
          shares: updatedShares,
          updatedAt: new Date().toISOString(),
        };
      })
    );

    return { success: true };
  };

  const deleteExpense = async (expenseId: string) => {
    if (!room?.id) return { success: false, error: 'No active room found' };

    if (token) {
      try {
        const res = await fetch(`${API_URL}/api/rooms/${room.id}/expenses/${expenseId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          await refreshExpenses();
          return { success: true };
        }
      } catch {
        // Fall through to offline deletion
      }
    }

    // Offline deletion
    setExpensesList((prev) => prev.filter((e) => e.id !== expenseId));
    return { success: true };
  };

  const getExpenseById = (id: string) => {
    return expensesList.find((e) => e.id === id);
  };

  return (
    <ExpenseContext.Provider
      value={{
        expenses: filteredExpenses,
        selectedPeriod,
        setSelectedPeriod,
        selectedCategory,
        setSelectedCategory,
        totalAmountPaise,
        isLoading,
        refreshExpenses,
        addExpense,
        updateExpense,
        deleteExpense,
        getExpenseById,
      }}
    >
      {children}
    </ExpenseContext.Provider>
  );
}

export function useExpenses() {
  const context = useContext(ExpenseContext);
  if (!context) {
    throw new Error('useExpenses must be used within an ExpenseProvider');
  }
  return context;
}
