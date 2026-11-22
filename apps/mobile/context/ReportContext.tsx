import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Share, Alert, Platform } from 'react-native';
import { useAuth } from './AuthContext';
import { useRoom } from './RoomContext';
import { formatPaise } from '../lib/utils';

export interface CategoryBreakdownItem {
  categoryId: string;
  name: string;
  amountPaise: number;
  count: number;
  color: string;
  percentage: number;
}

export interface MemberSummaryItem {
  userId: string;
  name: string;
  equalSharePaise: number;
  upfrontPaidPaise: number;
  netOwedPaise: number;
  amountPaidPaise: number;
  paymentStatus: 'confirmed' | 'sent' | 'pending' | 'settled';
}

export interface MonthlyReport {
  roomId: string;
  period: string;
  isFinalized: boolean;
  totalRentPaise: number;
  totalExpensesPaise: number;
  totalCarriedForwardPaise: number;
  totalAdjustmentsPaise: number;
  grandTotalPaise: number;
  memberCount: number;
  categoryBreakdown: CategoryBreakdownItem[];
  memberSummaries: MemberSummaryItem[];
  waterCount: number;
  waterTotalPaise: number;
  expenseCount: number;
}

export interface CategoryDeltaItem {
  name: string;
  color: string;
  baseAmountPaise: number;
  compareAmountPaise: number;
  deltaPaise: number;
  percentageChange: number;
}

export interface ComparisonDetails {
  differenceGrandTotalPaise: number;
  differenceExpensesPaise: number;
  differenceRentPaise: number;
  percentageChangeGrandTotal: number;
  percentageChangeExpenses: number;
  categoryDeltas: CategoryDeltaItem[];
}

export interface MonthComparisonData {
  basePeriod: string;
  comparePeriod: string;
  baseReport: MonthlyReport;
  compareReport: MonthlyReport;
  comparison: ComparisonDetails;
}

export interface PeriodOverviewItem {
  period: string;
  isFinalized: boolean;
  totalRentPaise: number;
  totalExpensesPaise: number;
  grandTotalPaise: number;
  memberCount: number;
}

interface ReportContextType {
  monthlyReport: MonthlyReport | null;
  comparisonData: MonthComparisonData | null;
  overviewPeriods: PeriodOverviewItem[];
  selectedPeriod: string;
  basePeriod: string;
  comparePeriod: string;
  isLoading: boolean;
  isComparing: boolean;
  error: string | null;
  setSelectedPeriod: (period: string) => void;
  setBasePeriod: (period: string) => void;
  setComparePeriod: (period: string) => void;
  fetchMonthlyReport: (period?: string) => Promise<void>;
  fetchComparison: (base?: string, compare?: string) => Promise<void>;
  fetchOverview: () => Promise<void>;
  shareMonthlyReport: () => Promise<void>;
  shareComparisonReport: () => Promise<void>;
}

const ReportContext = createContext<ReportContextType | undefined>(undefined);
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://pg-expense-manager-api.luqman-gohil-pro.workers.dev';

// Fallback demo data
const demoMonthlyReportNov: MonthlyReport = {
  roomId: 'r3023023-3023-3023-3023-302330233023',
  period: '2026-11',
  isFinalized: false,
  totalRentPaise: 2800000,
  totalExpensesPaise: 448900,
  totalCarriedForwardPaise: 0,
  totalAdjustmentsPaise: 0,
  grandTotalPaise: 3248900,
  memberCount: 4,
  waterCount: 9,
  waterTotalPaise: 36000,
  expenseCount: 5,
  categoryBreakdown: [
    { categoryId: 'c1', name: 'Wi-Fi', amountPaise: 159900, count: 1, color: '#7C3AED', percentage: 35.6 },
    { categoryId: 'c2', name: 'Groceries', amountPaise: 145000, count: 2, color: '#059669', percentage: 32.3 },
    { categoryId: 'c3', name: 'Maintenance', amountPaise: 108000, count: 1, color: '#475569', percentage: 24.1 },
    { categoryId: 'cat-water', name: 'Water', amountPaise: 36000, count: 9, color: '#0284C7', percentage: 8.0 },
  ],
  memberSummaries: [
    {
      userId: 'u1111111-1111-1111-1111-111111111111',
      name: 'Rahul Sharma',
      equalSharePaise: 812225,
      upfrontPaidPaise: 267900,
      netOwedPaise: 544325,
      amountPaidPaise: 0,
      paymentStatus: 'pending',
    },
    {
      userId: 'u2222222-2222-2222-2222-222222222222',
      name: 'Aman Verma',
      equalSharePaise: 812225,
      upfrontPaidPaise: 181000,
      netOwedPaise: 631225,
      amountPaidPaise: 0,
      paymentStatus: 'pending',
    },
    {
      userId: 'u3333333-3333-3333-3333-333333333333',
      name: 'Kunal Patel',
      equalSharePaise: 812225,
      upfrontPaidPaise: 0,
      netOwedPaise: 812225,
      amountPaidPaise: 0,
      paymentStatus: 'pending',
    },
    {
      userId: 'u4444444-4444-4444-4444-444444444444',
      name: 'Sameer Rao',
      equalSharePaise: 812225,
      upfrontPaidPaise: 0,
      netOwedPaise: 812225,
      amountPaidPaise: 0,
      paymentStatus: 'pending',
    },
  ],
};

const demoMonthlyReportOct: MonthlyReport = {
  roomId: 'r3023023-3023-3023-3023-302330233023',
  period: '2026-10',
  isFinalized: true,
  totalRentPaise: 2800000,
  totalExpensesPaise: 360000,
  totalCarriedForwardPaise: 0,
  totalAdjustmentsPaise: 0,
  grandTotalPaise: 3160000,
  memberCount: 4,
  waterCount: 3,
  waterTotalPaise: 12000,
  expenseCount: 1,
  categoryBreakdown: [
    { categoryId: 'cat-elec', name: 'Electricity', amountPaise: 360000, count: 1, color: '#D97706', percentage: 100.0 },
  ],
  memberSummaries: [
    {
      userId: 'u1111111-1111-1111-1111-111111111111',
      name: 'Rahul Sharma',
      equalSharePaise: 790000,
      upfrontPaidPaise: 360000,
      netOwedPaise: 430000,
      amountPaidPaise: 430000,
      paymentStatus: 'confirmed',
    },
    {
      userId: 'u2222222-2222-2222-2222-222222222222',
      name: 'Aman Verma',
      equalSharePaise: 790000,
      upfrontPaidPaise: 0,
      netOwedPaise: 790000,
      amountPaidPaise: 790000,
      paymentStatus: 'confirmed',
    },
    {
      userId: 'u3333333-3333-3333-3333-333333333333',
      name: 'Kunal Patel',
      equalSharePaise: 790000,
      upfrontPaidPaise: 0,
      netOwedPaise: 790000,
      amountPaidPaise: 790000,
      paymentStatus: 'confirmed',
    },
    {
      userId: 'u4444444-4444-4444-4444-444444444444',
      name: 'Sameer Rao',
      equalSharePaise: 790000,
      upfrontPaidPaise: 0,
      netOwedPaise: 790000,
      amountPaidPaise: 790000,
      paymentStatus: 'confirmed',
    },
  ],
};

export const ReportProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const { room } = useRoom();

  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026-11');
  const [basePeriod, setBasePeriod] = useState<string>('2026-10');
  const [comparePeriod, setComparePeriod] = useState<string>('2026-11');

  const [monthlyReport, setMonthlyReport] = useState<MonthlyReport | null>(demoMonthlyReportNov);
  const [comparisonData, setComparisonData] = useState<MonthComparisonData | null>(null);
  const [overviewPeriods, setOverviewPeriods] = useState<PeriodOverviewItem[]>([
    { period: '2026-10', isFinalized: true, totalRentPaise: 2800000, totalExpensesPaise: 360000, grandTotalPaise: 3160000, memberCount: 4 },
    { period: '2026-11', isFinalized: false, totalRentPaise: 2800000, totalExpensesPaise: 448900, grandTotalPaise: 3248900, memberCount: 4 },
  ]);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const roomId = room?.id || 'r3023023-3023-3023-3023-302330233023';

  // 1. Fetch Monthly Report
  const fetchMonthlyReport = useCallback(
    async (periodToFetch?: string) => {
      const p = periodToFetch || selectedPeriod;
      setIsLoading(true);
      setError(null);
      try {
        const authToken = token || 'pg_mock_token_offline';
        const res = await fetch(`${API_URL}/api/rooms/${roomId}/reports/monthly?period=${p}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.report) {
            setMonthlyReport(data.report);
          }
        } else {
          // Fallback to local
          setMonthlyReport(p === '2026-10' ? demoMonthlyReportOct : demoMonthlyReportNov);
        }
      } catch (err) {
        // Fallback gracefully on network error
        setMonthlyReport(p === '2026-10' ? demoMonthlyReportOct : demoMonthlyReportNov);
      } finally {
        setIsLoading(false);
      }
    },
    [roomId, selectedPeriod, token]
  );

  // 2. Fetch Comparison
  const fetchComparison = useCallback(
    async (baseP?: string, compareP?: string) => {
      const b = baseP || basePeriod;
      const c = compareP || comparePeriod;
      setIsComparing(true);
      setError(null);
      try {
        const authToken = token || 'pg_mock_token_offline';
        const res = await fetch(
          `${API_URL}/api/rooms/${roomId}/reports/comparison?basePeriod=${b}&comparePeriod=${c}`,
          {
            headers: { Authorization: `Bearer ${authToken}` },
          }
        );

        if (res.ok) {
          const data = await res.json();
          setComparisonData({
            basePeriod: data.basePeriod,
            comparePeriod: data.comparePeriod,
            baseReport: data.baseReport,
            compareReport: data.compareReport,
            comparison: data.comparison,
          });
        } else {
          // Compute local comparison
          computeFallbackComparison(b, c);
        }
      } catch (err) {
        computeFallbackComparison(b, c);
      } finally {
        setIsComparing(false);
      }
    },
    [roomId, basePeriod, comparePeriod, token]
  );

  // Local comparison generator
  const computeFallbackComparison = (b: string, c: string) => {
    const baseRep = b === '2026-10' ? demoMonthlyReportOct : demoMonthlyReportNov;
    const compareRep = c === '2026-11' ? demoMonthlyReportNov : demoMonthlyReportOct;

    const diffGrand = compareRep.grandTotalPaise - baseRep.grandTotalPaise;
    const diffExpenses = compareRep.totalExpensesPaise - baseRep.totalExpensesPaise;
    const diffRent = compareRep.totalRentPaise - baseRep.totalRentPaise;
    const pctGrand =
      baseRep.grandTotalPaise > 0
        ? Math.round((diffGrand / baseRep.grandTotalPaise) * 1000) / 10
        : 0;
    const pctExpenses =
      baseRep.totalExpensesPaise > 0
        ? Math.round((diffExpenses / baseRep.totalExpensesPaise) * 1000) / 10
        : 0;

    const allCatNames = Array.from(
      new Set([
        ...baseRep.categoryBreakdown.map((item) => item.name),
        ...compareRep.categoryBreakdown.map((item) => item.name),
      ])
    );

    const categoryDeltas: CategoryDeltaItem[] = allCatNames.map((catName) => {
      const bCat = baseRep.categoryBreakdown.find((item) => item.name === catName);
      const cCat = compareRep.categoryBreakdown.find((item) => item.name === catName);
      const bAmt = bCat?.amountPaise || 0;
      const cAmt = cCat?.amountPaise || 0;
      const dPaise = cAmt - bAmt;
      const pct = bAmt > 0 ? Math.round((dPaise / bAmt) * 1000) / 10 : cAmt > 0 ? 100 : 0;
      return {
        name: catName,
        color: cCat?.color || bCat?.color || '#64748B',
        baseAmountPaise: bAmt,
        compareAmountPaise: cAmt,
        deltaPaise: dPaise,
        percentageChange: pct,
      };
    }).sort((x, y) => Math.abs(y.deltaPaise) - Math.abs(x.deltaPaise));

    setComparisonData({
      basePeriod: b,
      comparePeriod: c,
      baseReport: baseRep,
      compareReport: compareRep,
      comparison: {
        differenceGrandTotalPaise: diffGrand,
        differenceExpensesPaise: diffExpenses,
        differenceRentPaise: diffRent,
        percentageChangeGrandTotal: pctGrand,
        percentageChangeExpenses: pctExpenses,
        categoryDeltas,
      },
    });
  };

  // 3. Fetch Overview
  const fetchOverview = useCallback(async () => {
    try {
      const authToken = token || 'pg_mock_token_offline';
      const res = await fetch(`${API_URL}/api/rooms/${roomId}/reports/overview`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.periods)) {
          setOverviewPeriods(data.periods);
        }
      }
    } catch {
      // keep initial fallback
    }
  }, [roomId, token]);

  // Initial load
  useEffect(() => {
    fetchMonthlyReport(selectedPeriod);
    fetchComparison(basePeriod, comparePeriod);
    fetchOverview();
  }, [selectedPeriod, basePeriod, comparePeriod, fetchMonthlyReport, fetchComparison, fetchOverview]);

  // Share Monthly Report Summary via Native Sheet
  const shareMonthlyReport = useCallback(async () => {
    if (!monthlyReport) return;
    const roomName = room?.name || 'Flat 302, Green Glen';

    const categoriesText = monthlyReport.categoryBreakdown
      .map((c) => `  • ${c.name}: ${formatPaise(c.amountPaise)} (${c.percentage}%)`)
      .join('\n');

    const membersText = monthlyReport.memberSummaries
      .map(
        (m) =>
          `  • ${m.name}: Share ${formatPaise(m.equalSharePaise)} | Paid ${formatPaise(
            m.upfrontPaidPaise
          )} | Net: ${formatPaise(m.netOwedPaise)} [${m.paymentStatus.toUpperCase()}]`
      )
      .join('\n');

    const message = [
      `📊 FINANCIAL REPORT - ${monthlyReport.period}`,
      `🏠 Room: ${roomName}`,
      `Status: ${monthlyReport.isFinalized ? '🔒 Finalized' : '📝 Draft Cycle'}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `💰 Total Rent: ${formatPaise(monthlyReport.totalRentPaise)}`,
      `🛒 Shared Expenses: ${formatPaise(monthlyReport.totalExpensesPaise)} (${monthlyReport.expenseCount} items)`,
      `💧 Water Deliveries: ${monthlyReport.waterCount} cans (${formatPaise(monthlyReport.waterTotalPaise)})`,
      `🎯 GRAND TOTAL: ${formatPaise(monthlyReport.grandTotalPaise)}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📂 EXPENSE BREAKDOWN:`,
      categoriesText || '  (No expenses recorded)',
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `👥 ROOMMATE SHARES:`,
      membersText,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Generated by PG Expense Manager`,
    ].join('\n');

    try {
      await Share.share({
        title: `${roomName} - ${monthlyReport.period} Report`,
        message,
      });
    } catch (err: any) {
      Alert.alert('Share Error', err.message || 'Unable to share report');
    }
  }, [monthlyReport, room?.name]);

  // Share Comparison Report via Native Sheet
  const shareComparisonReport = useCallback(async () => {
    if (!comparisonData) return;
    const roomName = room?.name || 'Flat 302, Green Glen';
    const comp = comparisonData.comparison;
    const sign = comp.differenceGrandTotalPaise >= 0 ? '+' : '';

    const deltasText = comp.categoryDeltas
      .map((d) => {
        const dSign = d.deltaPaise >= 0 ? '+' : '';
        return `  • ${d.name}: ${formatPaise(d.baseAmountPaise)} ➔ ${formatPaise(
          d.compareAmountPaise
        )} (${dSign}${formatPaise(d.deltaPaise)}, ${dSign}${d.percentageChange}%)`;
      })
      .join('\n');

    const message = [
      `📈 MONTH COMPARISON: ${comparisonData.basePeriod} vs ${comparisonData.comparePeriod}`,
      `🏠 Room: ${roomName}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Base Total (${comparisonData.basePeriod}): ${formatPaise(comparisonData.baseReport.grandTotalPaise)}`,
      `Compare Total (${comparisonData.comparePeriod}): ${formatPaise(comparisonData.compareReport.grandTotalPaise)}`,
      `Net Shift: ${sign}${formatPaise(comp.differenceGrandTotalPaise)} (${sign}${comp.percentageChangeGrandTotal}%)`,
      `Expenses Shift: ${comp.differenceExpensesPaise >= 0 ? '+' : ''}${formatPaise(comp.differenceExpensesPaise)} (${comp.percentageChangeExpenses >= 0 ? '+' : ''}${comp.percentageChangeExpenses}%)`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📂 CATEGORY SHIFTS:`,
      deltasText,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Generated by PG Expense Manager`,
    ].join('\n');

    try {
      await Share.share({
        title: `${roomName} - Spend Comparison`,
        message,
      });
    } catch (err: any) {
      Alert.alert('Share Error', err.message || 'Unable to share comparison');
    }
  }, [comparisonData, room?.name]);

  const value = useMemo(
    () => ({
      monthlyReport,
      comparisonData,
      overviewPeriods,
      selectedPeriod,
      basePeriod,
      comparePeriod,
      isLoading,
      isComparing,
      error,
      setSelectedPeriod,
      setBasePeriod,
      setComparePeriod,
      fetchMonthlyReport,
      fetchComparison,
      fetchOverview,
      shareMonthlyReport,
      shareComparisonReport,
    }),
    [
      monthlyReport,
      comparisonData,
      overviewPeriods,
      selectedPeriod,
      basePeriod,
      comparePeriod,
      isLoading,
      isComparing,
      error,
      fetchMonthlyReport,
      fetchComparison,
      fetchOverview,
      shareMonthlyReport,
      shareComparisonReport,
    ]
  );

  return <ReportContext.Provider value={value}>{children}</ReportContext.Provider>;
};

export const useReport = (): ReportContextType => {
  const context = useContext(ReportContext);
  if (!context) {
    throw new Error('useReport must be used within a ReportProvider');
  }
  return context;
};
