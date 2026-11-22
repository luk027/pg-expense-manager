import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  StatusBar as RNStatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useReport } from '../context/ReportContext';
import { useRoom } from '../context/RoomContext';
import { colors, space, radius, type } from '../lib/tokens';
import { formatPaise } from '../lib/utils';

export default function ReportsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset =
    Math.max(insets.top, Platform.OS === 'android' ? RNStatusBar.currentHeight || 28 : 0, 24) + 8;

  const { room } = useRoom();
  const {
    monthlyReport,
    comparisonData,
    overviewPeriods,
    selectedPeriod,
    basePeriod,
    comparePeriod,
    isLoading,
    isComparing,
    setSelectedPeriod,
    setBasePeriod,
    setComparePeriod,
    fetchMonthlyReport,
    fetchComparison,
    shareMonthlyReport,
    shareComparisonReport,
  } = useReport();

  const [activeTab, setActiveTab] = useState<'monthly' | 'comparison'>('monthly');
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const onRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'monthly') {
      await fetchMonthlyReport(selectedPeriod);
    } else {
      await fetchComparison(basePeriod, comparePeriod);
    }
    setRefreshing(false);
  };

  const formatPeriodLabel = (p: string) => {
    const [year, month] = p.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
  };

  return (
    <View style={styles.safeArea}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topInset }]}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Feather name="arrow-left" size={20} color={colors.ink} />
        </Pressable>
        <View style={styles.headerTitleCol}>
          <Text style={styles.headerTitle}>Financial Reports</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {room?.name || 'Flat 302, Green Glen'}
          </Text>
        </View>
        <Pressable
          style={styles.shareButton}
          onPress={activeTab === 'monthly' ? shareMonthlyReport : shareComparisonReport}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Feather name="share-2" size={18} color={colors.primary} />
        </Pressable>
      </View>

      {/* Segmented Tab Switcher */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tabButton, activeTab === 'monthly' && styles.tabButtonActive]}
          onPress={() => setActiveTab('monthly')}
        >
          <Feather
            name="pie-chart"
            size={15}
            color={activeTab === 'monthly' ? colors.primary : colors.inkSecondary}
          />
          <Text
            style={[styles.tabButtonText, activeTab === 'monthly' && styles.tabButtonTextActive]}
          >
            Monthly Breakdown
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, activeTab === 'comparison' && styles.tabButtonActive]}
          onPress={() => setActiveTab('comparison')}
        >
          <Feather
            name="trending-up"
            size={15}
            color={activeTab === 'comparison' ? colors.primary : colors.inkSecondary}
          />
          <Text
            style={[styles.tabButtonText, activeTab === 'comparison' && styles.tabButtonTextActive]}
          >
            Month Comparison
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {activeTab === 'monthly' ? (
          // ==========================================
          // TAB 1: MONTHLY BREAKDOWN
          // ==========================================
          <View style={styles.tabContent}>
            {/* Period Switcher Pills */}
            <View style={styles.periodRow}>
              <View style={styles.periodPillsContainer}>
                {overviewPeriods.map((p) => {
                  const isSelected = selectedPeriod === p.period;
                  return (
                    <Pressable
                      key={p.period}
                      style={[styles.periodPill, isSelected && styles.periodPillActive]}
                      onPress={() => {
                        setSelectedPeriod(p.period);
                        fetchMonthlyReport(p.period);
                      }}
                    >
                      <Text
                        style={[
                          styles.periodPillText,
                          isSelected && styles.periodPillTextActive,
                        ]}
                      >
                        {formatPeriodLabel(p.period)}
                      </Text>
                      {p.isFinalized && (
                        <View style={styles.finalizedDot} />
                      )}
                    </Pressable>
                  );
                })}
              </View>

              <View
                style={[
                  styles.statusBadge,
                  monthlyReport?.isFinalized ? styles.statusBadgeFinalized : styles.statusBadgeDraft,
                ]}
              >
                <Feather
                  name={monthlyReport?.isFinalized ? 'lock' : 'edit-3'}
                  size={11}
                  color={monthlyReport?.isFinalized ? colors.success : colors.warning}
                />
                <Text
                  style={[
                    styles.statusBadgeText,
                    monthlyReport?.isFinalized
                      ? styles.statusBadgeTextFinalized
                      : styles.statusBadgeTextDraft,
                  ]}
                >
                  {monthlyReport?.isFinalized ? 'Finalized' : 'Draft Cycle'}
                </Text>
              </View>
            </View>

            {isLoading ? (
              <View style={styles.loaderBox}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loaderText}>Loading monthly report...</Text>
              </View>
            ) : monthlyReport ? (
              <>
                {/* Hero Financial Summary Card */}
                <View style={styles.heroCard}>
                  <Text style={styles.heroLabel}>Grand Total Expenditure</Text>
                  <Text style={[styles.heroAmount, { fontVariant: ['tabular-nums'] }]}>
                    {formatPaise(monthlyReport.grandTotalPaise)}
                  </Text>
                  <Text style={styles.heroSub}>
                    Split across {monthlyReport.memberCount} roommates ({formatPaise(Math.round(monthlyReport.grandTotalPaise / (monthlyReport.memberCount || 1)))}/roommate)
                  </Text>

                  <View style={styles.divider} />

                  <View style={styles.twoColMetrics}>
                    <View style={styles.metricItem}>
                      <View style={styles.metricHeaderRow}>
                        <View style={[styles.metricDot, { backgroundColor: '#1E40AF' }]} />
                        <Text style={styles.metricLabel}>Monthly Rent</Text>
                      </View>
                      <Text style={[styles.metricValue, { fontVariant: ['tabular-nums'] }]}>
                        {formatPaise(monthlyReport.totalRentPaise)}
                      </Text>
                      <Text style={styles.metricSub}>Fixed landlord lease</Text>
                    </View>

                    <View style={styles.metricItemBordered}>
                      <View style={styles.metricHeaderRow}>
                        <View style={[styles.metricDot, { backgroundColor: '#059669' }]} />
                        <Text style={styles.metricLabel}>Shared Expenses</Text>
                      </View>
                      <Text style={[styles.metricValue, { fontVariant: ['tabular-nums'] }]}>
                        {formatPaise(monthlyReport.totalExpensesPaise)}
                      </Text>
                      <Text style={styles.metricSub}>
                        {monthlyReport.expenseCount} bills · {monthlyReport.waterCount} water cans
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Category Spend Distribution Card */}
                <View style={styles.sectionCard}>
                  <View style={styles.sectionCardHeader}>
                    <Text style={styles.sectionCardTitle}>Category Breakdown</Text>
                    <Text style={styles.sectionCardSubtitle}>
                      {monthlyReport.categoryBreakdown.length} Categories
                    </Text>
                  </View>

                  {/* Horizontal Stacked Percentage Bar */}
                  {monthlyReport.categoryBreakdown.length > 0 && (
                    <View style={styles.stackedBarContainer}>
                      <View style={styles.stackedBar}>
                        {monthlyReport.categoryBreakdown.map((cat, idx) => {
                          const flexVal = Math.max(cat.percentage, 4);
                          return (
                            <View
                              key={cat.categoryId || idx}
                              style={[
                                styles.stackedSegment,
                                {
                                  flex: flexVal,
                                  backgroundColor: cat.color,
                                  borderTopLeftRadius: idx === 0 ? 6 : 0,
                                  borderBottomLeftRadius: idx === 0 ? 6 : 0,
                                  borderTopRightRadius:
                                    idx === monthlyReport.categoryBreakdown.length - 1 ? 6 : 0,
                                  borderBottomRightRadius:
                                    idx === monthlyReport.categoryBreakdown.length - 1 ? 6 : 0,
                                },
                              ]}
                            />
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {/* Category Items List */}
                  <View style={styles.categoryList}>
                    {monthlyReport.categoryBreakdown.map((cat) => (
                      <View key={cat.categoryId} style={styles.categoryRow}>
                        <View style={styles.categoryLeft}>
                          <View style={[styles.categoryColorDot, { backgroundColor: cat.color }]} />
                          <View style={styles.categoryInfo}>
                            <Text style={styles.categoryName}>{cat.name}</Text>
                            <Text style={styles.categoryCount}>
                              {cat.count} {cat.count === 1 ? 'record' : 'records'}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.categoryRight}>
                          <Text style={[styles.categoryAmount, { fontVariant: ['tabular-nums'] }]}>
                            {formatPaise(cat.amountPaise)}
                          </Text>
                          <View style={styles.percentagePill}>
                            <Text style={styles.percentageText}>{cat.percentage}%</Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Roommate Shares & Payment Status Card */}
                <View style={styles.sectionCard}>
                  <View style={styles.sectionCardHeader}>
                    <Text style={styles.sectionCardTitle}>Roommate Settlement Shares</Text>
                    <Text style={styles.sectionCardSubtitle}>Full payment rule</Text>
                  </View>

                  <View style={styles.membersList}>
                    {monthlyReport.memberSummaries.map((m) => {
                      const isConfirmed = m.paymentStatus === 'confirmed';
                      const isSent = m.paymentStatus === 'sent';
                      const isSettled = m.paymentStatus === 'settled';

                      return (
                        <View key={m.userId} style={styles.memberRow}>
                          <View style={styles.memberAvatar}>
                            <Text style={styles.memberAvatarInitial}>{m.name[0] || 'U'}</Text>
                          </View>

                          <View style={styles.memberDetails}>
                            <View style={styles.memberNameRow}>
                              <Text style={styles.memberName}>{m.name}</Text>
                              <View
                                style={[
                                  styles.paymentStatusPill,
                                  isConfirmed
                                    ? styles.statusPillConfirmed
                                    : isSent
                                    ? styles.statusPillSent
                                    : isSettled
                                    ? styles.statusPillSettled
                                    : styles.statusPillPending,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.paymentStatusText,
                                    isConfirmed
                                      ? styles.statusTextConfirmed
                                      : isSent
                                      ? styles.statusTextSent
                                      : isSettled
                                      ? styles.statusTextSettled
                                      : styles.statusTextPending,
                                  ]}
                                >
                                  {isConfirmed
                                    ? 'Paid'
                                    : isSent
                                    ? 'Sent'
                                    : isSettled
                                    ? 'Settled'
                                    : 'Pending'}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.memberFinancials}>
                              <Text style={styles.memberSubFin}>
                                Share: {formatPaise(m.equalSharePaise)} · Paid upfront: {formatPaise(m.upfrontPaidPaise)}
                              </Text>
                              <Text style={[styles.memberNetOwed, { fontVariant: ['tabular-nums'] }]}>
                                Net: {formatPaise(m.netOwedPaise)}
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* Share Button Action */}
                <Pressable
                  style={({ pressed }) => [styles.shareActionButton, pressed && styles.buttonPressed]}
                  onPress={shareMonthlyReport}
                >
                  <Feather name="share" size={16} color="#FFFFFF" />
                  <Text style={styles.shareActionText}>Share Financial Report</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        ) : (
          // ==========================================
          // TAB 2: MONTH COMPARISON
          // ==========================================
          <View style={styles.tabContent}>
            {/* Comparison Controls */}
            <View style={styles.comparisonSelectors}>
              <View style={styles.selectorCol}>
                <Text style={styles.selectorLabel}>Base Month</Text>
                <Pressable
                  style={styles.selectorPill}
                  onPress={() => {
                    const newBase = basePeriod === '2026-10' ? '2026-11' : '2026-10';
                    setBasePeriod(newBase);
                    fetchComparison(newBase, comparePeriod);
                  }}
                >
                  <Feather name="calendar" size={13} color={colors.primary} />
                  <Text style={styles.selectorPillText}>{formatPeriodLabel(basePeriod)}</Text>
                  <Feather name="refresh-cw" size={11} color={colors.inkTertiary} />
                </Pressable>
              </View>

              <View style={styles.selectorArrow}>
                <Feather name="arrow-right" size={16} color={colors.inkSecondary} />
              </View>

              <View style={styles.selectorCol}>
                <Text style={styles.selectorLabel}>Compare Month</Text>
                <Pressable
                  style={styles.selectorPill}
                  onPress={() => {
                    const newCompare = comparePeriod === '2026-11' ? '2026-10' : '2026-11';
                    setComparePeriod(newCompare);
                    fetchComparison(basePeriod, newCompare);
                  }}
                >
                  <Feather name="calendar" size={13} color={colors.primary} />
                  <Text style={styles.selectorPillText}>{formatPeriodLabel(comparePeriod)}</Text>
                  <Feather name="refresh-cw" size={11} color={colors.inkTertiary} />
                </Pressable>
              </View>
            </View>

            {isComparing ? (
              <View style={styles.loaderBox}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loaderText}>Comparing spending patterns...</Text>
              </View>
            ) : comparisonData ? (
              <>
                {/* Comparison Delta Hero Card */}
                <View style={styles.heroCard}>
                  <View style={styles.deltaHeaderRow}>
                    <Text style={styles.heroLabel}>Net Spending Variance</Text>
                    <View
                      style={[
                        styles.deltaPill,
                        comparisonData.comparison.differenceGrandTotalPaise <= 0
                          ? styles.deltaPillDecrease
                          : styles.deltaPillIncrease,
                      ]}
                    >
                      <Feather
                        name={
                          comparisonData.comparison.differenceGrandTotalPaise <= 0
                            ? 'trending-down'
                            : 'trending-up'
                        }
                        size={13}
                        color={
                          comparisonData.comparison.differenceGrandTotalPaise <= 0
                            ? colors.success
                            : colors.warning
                        }
                      />
                      <Text
                        style={[
                          styles.deltaPillText,
                          comparisonData.comparison.differenceGrandTotalPaise <= 0
                            ? styles.deltaTextDecrease
                            : styles.deltaTextIncrease,
                        ]}
                      >
                        {comparisonData.comparison.differenceGrandTotalPaise >= 0 ? '+' : ''}
                        {formatPaise(comparisonData.comparison.differenceGrandTotalPaise)} (
                        {comparisonData.comparison.percentageChangeGrandTotal >= 0 ? '+' : ''}
                        {comparisonData.comparison.percentageChangeGrandTotal}%)
                      </Text>
                    </View>
                  </View>

                  {/* Side-by-Side Month Summary */}
                  <View style={styles.comparisonGrid}>
                    <View style={styles.compareCol}>
                      <Text style={styles.compareColPeriod}>
                        {formatPeriodLabel(comparisonData.basePeriod)}
                      </Text>
                      <Text style={[styles.compareColTotal, { fontVariant: ['tabular-nums'] }]}>
                        {formatPaise(comparisonData.baseReport.grandTotalPaise)}
                      </Text>
                      <Text style={styles.compareColExpenses}>
                        Expenses: {formatPaise(comparisonData.baseReport.totalExpensesPaise)}
                      </Text>
                    </View>

                    <View style={styles.compareColDivider} />

                    <View style={styles.compareCol}>
                      <Text style={styles.compareColPeriod}>
                        {formatPeriodLabel(comparisonData.comparePeriod)}
                      </Text>
                      <Text style={[styles.compareColTotal, { fontVariant: ['tabular-nums'] }]}>
                        {formatPaise(comparisonData.compareReport.grandTotalPaise)}
                      </Text>
                      <Text style={styles.compareColExpenses}>
                        Expenses: {formatPaise(comparisonData.compareReport.totalExpensesPaise)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.insightBox}>
                    <Feather name="info" size={13} color={colors.primary} />
                    <Text style={styles.insightText}>
                      Expenses shifted by{' '}
                      {comparisonData.comparison.differenceExpensesPaise >= 0 ? '+' : ''}
                      {formatPaise(comparisonData.comparison.differenceExpensesPaise)} (
                      {comparisonData.comparison.percentageChangeExpenses >= 0 ? '+' : ''}
                      {comparisonData.comparison.percentageChangeExpenses}%). Rent remained stable at{' '}
                      {formatPaise(comparisonData.compareReport.totalRentPaise)}.
                    </Text>
                  </View>
                </View>

                {/* Category Shifts Card */}
                <View style={styles.sectionCard}>
                  <View style={styles.sectionCardHeader}>
                    <Text style={styles.sectionCardTitle}>Category Shift Deltas</Text>
                    <Text style={styles.sectionCardSubtitle}>Sorted by highest variance</Text>
                  </View>

                  <View style={styles.categoryList}>
                    {comparisonData.comparison.categoryDeltas.map((delta) => {
                      const isUp = delta.deltaPaise > 0;
                      const isZero = delta.deltaPaise === 0;

                      return (
                        <View key={delta.name} style={styles.deltaRow}>
                          <View style={styles.deltaLeft}>
                            <View
                              style={[styles.categoryColorDot, { backgroundColor: delta.color }]}
                            />
                            <View style={styles.deltaInfo}>
                              <Text style={styles.categoryName}>{delta.name}</Text>
                              <Text style={styles.deltaPath}>
                                {formatPaise(delta.baseAmountPaise)} ➔ {formatPaise(delta.compareAmountPaise)}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.deltaRight}>
                            <Text
                              style={[
                                styles.deltaAmount,
                                { fontVariant: ['tabular-nums'] },
                                isZero
                                  ? styles.deltaAmountZero
                                  : isUp
                                  ? styles.deltaAmountUp
                                  : styles.deltaAmountDown,
                              ]}
                            >
                              {isUp ? '+' : ''}
                              {formatPaise(delta.deltaPaise)}
                            </Text>
                            <View
                              style={[
                                styles.deltaPctBadge,
                                isZero
                                  ? styles.deltaPctBadgeZero
                                  : isUp
                                  ? styles.deltaPctBadgeUp
                                  : styles.deltaPctBadgeDown,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.deltaPctText,
                                  isZero
                                    ? styles.deltaPctTextZero
                                    : isUp
                                    ? styles.deltaPctTextUp
                                    : styles.deltaPctTextDown,
                                ]}
                              >
                                {isUp ? '+' : ''}
                                {delta.percentageChange}%
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* Share Comparison Action */}
                <Pressable
                  style={({ pressed }) => [styles.shareActionButton, pressed && styles.buttonPressed]}
                  onPress={shareComparisonReport}
                >
                  <Feather name="share" size={16} color="#FFFFFF" />
                  <Text style={styles.shareActionText}>Share Month Comparison</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: space.xs,
  },
  headerTitleCol: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    ...type.title,
    color: colors.ink,
  },
  headerSub: {
    ...type.caption,
    color: colors.inkSecondary,
    marginTop: 2,
  },
  shareButton: {
    padding: space.xs,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.sm + 2,
    borderRadius: radius.md,
    gap: space.xs + 2,
  },
  tabButtonActive: {
    backgroundColor: colors.primarySoft,
  },
  tabButtonText: {
    ...type.label,
    color: colors.inkSecondary,
  },
  tabButtonTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  contentContainer: {
    padding: space.lg,
    paddingBottom: space.xxl + 20,
  },
  tabContent: {
    gap: space.lg,
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  periodPillsContainer: {
    flexDirection: 'row',
    gap: space.sm,
  },
  periodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: space.xs,
  },
  periodPillActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  periodPillText: {
    ...type.caption,
    color: colors.ink,
    fontWeight: '600',
  },
  periodPillTextActive: {
    color: '#FFFFFF',
  },
  finalizedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm + 2,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    gap: 4,
  },
  statusBadgeFinalized: {
    backgroundColor: colors.successSoft,
  },
  statusBadgeDraft: {
    backgroundColor: colors.warningSoft,
  },
  statusBadgeText: {
    ...type.caption,
    fontWeight: '600',
  },
  statusBadgeTextFinalized: {
    color: colors.success,
  },
  statusBadgeTextDraft: {
    color: colors.warning,
  },
  loaderBox: {
    padding: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    gap: space.sm,
  },
  loaderText: {
    ...type.caption,
    color: colors.inkSecondary,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  heroLabel: {
    ...type.caption,
    color: colors.inkSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroAmount: {
    ...type.display,
    color: colors.ink,
    marginVertical: space.xs,
  },
  heroSub: {
    ...type.caption,
    color: colors.inkSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: space.md,
  },
  twoColMetrics: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  metricItem: {
    flex: 1,
    paddingRight: space.md,
  },
  metricItemBordered: {
    flex: 1,
    paddingLeft: space.md,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  metricHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginBottom: 2,
  },
  metricDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metricLabel: {
    ...type.caption,
    color: colors.inkSecondary,
    fontWeight: '500',
  },
  metricValue: {
    ...type.title,
    color: colors.ink,
    fontSize: 18,
    lineHeight: 24,
  },
  metricSub: {
    ...type.caption,
    color: colors.inkTertiary,
    fontSize: 11,
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  sectionCardTitle: {
    ...type.title,
    fontSize: 16,
    lineHeight: 22,
    color: colors.ink,
  },
  sectionCardSubtitle: {
    ...type.caption,
    color: colors.inkTertiary,
  },
  stackedBarContainer: {
    marginBottom: space.md,
  },
  stackedBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  stackedSegment: {
    height: '100%',
  },
  categoryList: {
    gap: space.md,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  categoryColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  categoryInfo: {
    gap: 1,
  },
  categoryName: {
    ...type.body,
    fontSize: 14,
    color: colors.ink,
    fontWeight: '500',
  },
  categoryCount: {
    ...type.caption,
    color: colors.inkTertiary,
    fontSize: 11,
  },
  categoryRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  categoryAmount: {
    ...type.body,
    fontSize: 14,
    color: colors.ink,
    fontWeight: '600',
  },
  percentagePill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: colors.surfaceMuted,
  },
  percentageText: {
    ...type.caption,
    fontSize: 10,
    color: colors.inkSecondary,
    fontWeight: '600',
  },
  membersList: {
    gap: space.md,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.xs,
  },
  memberAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarInitial: {
    ...type.title,
    fontSize: 16,
    color: colors.primary,
  },
  memberDetails: {
    flex: 1,
    gap: 2,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  memberName: {
    ...type.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  paymentStatusPill: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  statusPillConfirmed: {
    backgroundColor: colors.successSoft,
  },
  statusPillSent: {
    backgroundColor: colors.primarySoft,
  },
  statusPillPending: {
    backgroundColor: colors.warningSoft,
  },
  statusPillSettled: {
    backgroundColor: colors.surfaceMuted,
  },
  paymentStatusText: {
    ...type.caption,
    fontSize: 11,
    fontWeight: '600',
  },
  statusTextConfirmed: {
    color: colors.success,
  },
  statusTextSent: {
    color: colors.primary,
  },
  statusTextPending: {
    color: colors.warning,
  },
  statusTextSettled: {
    color: colors.inkSecondary,
  },
  memberFinancials: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  memberSubFin: {
    ...type.caption,
    fontSize: 11,
    color: colors.inkSecondary,
  },
  memberNetOwed: {
    ...type.caption,
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink,
  },
  shareActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: space.md,
    borderRadius: radius.md,
    gap: space.sm,
    marginTop: space.sm,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  shareActionText: {
    ...type.label,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  comparisonSelectors: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectorCol: {
    flex: 1,
    gap: 4,
  },
  selectorLabel: {
    ...type.caption,
    fontSize: 11,
    color: colors.inkTertiary,
  },
  selectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.sm + 2,
    paddingVertical: space.xs + 2,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  selectorPillText: {
    ...type.caption,
    fontWeight: '600',
    color: colors.ink,
  },
  selectorArrow: {
    paddingHorizontal: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deltaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  deltaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
    gap: 4,
  },
  deltaPillIncrease: {
    backgroundColor: colors.warningSoft,
  },
  deltaPillDecrease: {
    backgroundColor: colors.successSoft,
  },
  deltaPillText: {
    ...type.caption,
    fontWeight: '600',
  },
  deltaTextIncrease: {
    color: colors.warning,
  },
  deltaTextDecrease: {
    color: colors.success,
  },
  comparisonGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.sm,
  },
  compareCol: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  compareColDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  compareColPeriod: {
    ...type.caption,
    color: colors.inkTertiary,
    fontSize: 11,
  },
  compareColTotal: {
    ...type.title,
    fontSize: 20,
    color: colors.ink,
  },
  compareColExpenses: {
    ...type.caption,
    fontSize: 11,
    color: colors.inkSecondary,
  },
  insightBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primarySoft,
    padding: space.sm + 2,
    borderRadius: radius.md,
    gap: space.xs + 2,
  },
  insightText: {
    ...type.caption,
    fontSize: 12,
    lineHeight: 16,
    color: colors.primary,
    flex: 1,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deltaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  deltaInfo: {
    gap: 1,
  },
  deltaPath: {
    ...type.caption,
    color: colors.inkTertiary,
    fontSize: 11,
  },
  deltaRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  deltaAmount: {
    ...type.body,
    fontSize: 13,
    fontWeight: '600',
  },
  deltaAmountUp: {
    color: colors.warning,
  },
  deltaAmountDown: {
    color: colors.success,
  },
  deltaAmountZero: {
    color: colors.inkTertiary,
  },
  deltaPctBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  deltaPctBadgeUp: {
    backgroundColor: colors.warningSoft,
  },
  deltaPctBadgeDown: {
    backgroundColor: colors.successSoft,
  },
  deltaPctBadgeZero: {
    backgroundColor: colors.surfaceMuted,
  },
  deltaPctText: {
    ...type.caption,
    fontSize: 10,
    fontWeight: '600',
  },
  deltaPctTextUp: {
    color: colors.warning,
  },
  deltaPctTextDown: {
    color: colors.success,
  },
  deltaPctTextZero: {
    color: colors.inkTertiary,
  },
});
