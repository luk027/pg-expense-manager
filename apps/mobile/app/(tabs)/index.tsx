import React, { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  SafeAreaView,
  Platform,
  StatusBar as RNStatusBar,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, space, radius } from '../../lib/tokens';
import { formatPaise } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { useRoom } from '../../context/RoomContext';
import { useSettlement } from '../../context/SettlementContext';
import { usePayments, PaymentItem, LandlordPaymentItem } from '../../context/PaymentContext';
import { useExpenses } from '../../context/ExpenseContext';
import { useWaterService } from '../../context/WaterServiceContext';
import { useNotifications } from '../../context/NotificationContext';
import { Avatar } from '../../components/ui/Avatar';
import { StatusPill } from '../../components/ui/StatusPill';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';

function getGreeting(name: string): string {
  const hour = new Date().getHours();
  let timeGreeting = 'Good morning';
  if (hour >= 12 && hour < 17) {
    timeGreeting = 'Good afternoon';
  } else if (hour >= 17 || hour < 5) {
    timeGreeting = 'Good evening';
  }
  const firstName = name ? name.split(' ')[0] : 'Roommate';
  return `${timeGreeting}, ${firstName}`;
}

function getDueDaysText(settlementDay: number = 30): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const targetDay = Math.min(settlementDay, new Date(year, month + 1, 0).getDate());
  const dueDate = new Date(year, month, targetDay);
  const diffTime = dueDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const monthName = dueDate.toLocaleDateString('en-US', { month: 'short' });

  if (diffDays <= 0) {
    return `Due today (${monthName} ${targetDay})`;
  } else if (diffDays === 1) {
    return `Due tomorrow (${monthName} ${targetDay})`;
  } else {
    return `Due ${monthName} ${targetDay} (${diffDays} days left)`;
  }
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { room, activeMembers, pendingMembers, isAdmin, isCollector, hasRoom, refreshRoom, isLoading: roomLoading } = useRoom();
  const {
    settlement,
    statement,
    memberShares,
    selectedPeriod,
    isFinalized,
    refreshSettlement,
    isLoading: settlementLoading,
  } = useSettlement();
  const {
    payments,
    landlordPayments,
    pendingConfirmations,
    refreshPayments,
    isLoading: paymentsLoading,
  } = usePayments();
  const { expenses, refreshExpenses, isLoading: expensesLoading } = useExpenses();
  const { waterDeliveries, refreshDeliveries, isLoading: waterLoading } = useWaterService();
  const { unreadCount, refreshNotifications } = useNotifications();

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshRoom(),
        refreshSettlement(),
        refreshExpenses(),
        refreshPayments(),
        refreshDeliveries(),
        refreshNotifications(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshRoom, refreshSettlement, refreshExpenses, refreshPayments, refreshDeliveries, refreshNotifications]);

  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (RNStatusBar.currentHeight || 28) : 0,
    24
  );

  // Settlement identification
  const currentSettlementId = settlement?.id || `set-${selectedPeriod}-flat302`;

  // Collector info
  const collectorMember = activeMembers.find((m) => m.userId === room?.collectorId);
  const collectorName = collectorMember ? collectorMember.name.split(' ')[0] : 'Admin';

  // Logged-in user's statement and payment
  const myStatement = statement?.memberStatements.find((m) => m.userId === user?.id);
  const myMemberShare = memberShares.find((s) => s.userId === user?.id);
  const myNetOwedPaise = myStatement?.netAmountOwedPaise ?? (myMemberShare?.amountOwedPaise || 0);

  const myPayment = payments.find(
    (p: PaymentItem) =>
      (p.settlementId === currentSettlementId || p.settlementId === `set-${selectedPeriod}-flat302`) &&
      p.payerUserId === user?.id &&
      p.status !== 'cancelled'
  );

  const isMyPaymentConfirmed = myPayment?.status === 'confirmed';
  const isMyPaymentPending = myPayment?.status === 'sent';

  // Collection progress metrics
  const totalDuePaise = useMemo(() => {
    if (memberShares.length > 0) {
      return memberShares.reduce((sum, s) => sum + Math.max(s.amountOwedPaise, 0), 0);
    }
    return statement?.grandTotalPaise || 2800000;
  }, [memberShares, statement]);

  const totalPaidPaise = useMemo(() => {
    return memberShares.reduce((sum, s) => sum + s.amountPaidPaise, 0);
  }, [memberShares]);

  const progressPercent = useMemo(() => {
    if (totalDuePaise > 0) {
      return Math.min(Math.round((totalPaidPaise / totalDuePaise) * 100), 100);
    }
    return isFinalized ? 100 : 0;
  }, [totalDuePaise, totalPaidPaise, isFinalized]);

  // Two-up metrics calculations
  const totalMonthExpensesPaise = useMemo(() => {
    if (statement?.totalExpensesPaise) return statement.totalExpensesPaise;
    const expTotal = expenses.reduce((sum, e) => sum + e.amountPaise, 0);
    const waterTotal = waterDeliveries.reduce((sum, w) => sum + w.pricePaise, 0);
    return expTotal + waterTotal;
  }, [statement, expenses, waterDeliveries]);

  const monthlyRentPaise = room?.monthlyRentPaise || 2800000;
  const perPersonRentPaise =
    activeMembers.length > 0
      ? Math.round(monthlyRentPaise / activeMembers.length)
      : Math.round(monthlyRentPaise / 4);

  // Landlord payment status for current cycle
  const landlordPayment = landlordPayments.find(
    (lp: LandlordPaymentItem) => lp.settlementId === currentSettlementId || lp.settlementId === `set-${selectedPeriod}-flat302`
  );
  const isLandlordPaid = !!landlordPayment;

  // Initial loading skeleton
  const isInitialLoading = roomLoading && !room;

  if (isInitialLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.container, { paddingTop: topInset + 8 }]}>
          <LoadingSkeleton width="40%" height={16} borderRadius={radius.sm} style={{ marginBottom: 8 }} />
          <LoadingSkeleton width="65%" height={28} borderRadius={radius.sm} style={{ marginBottom: 20 }} />
          <LoadingSkeleton width="100%" height={170} borderRadius={radius.lg} style={{ marginBottom: 20 }} />
          <View style={{ flexDirection: 'row', gap: space.md, marginBottom: 20 }}>
            <LoadingSkeleton width="48%" height={90} borderRadius={radius.md} />
            <LoadingSkeleton width="48%" height={90} borderRadius={radius.md} />
          </View>
          <LoadingSkeleton width="30%" height={18} borderRadius={radius.sm} style={{ marginBottom: 12 }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginBottom: 24 }}>
            <LoadingSkeleton width="47.5%" height={80} borderRadius={radius.md} />
            <LoadingSkeleton width="47.5%" height={80} borderRadius={radius.md} />
            <LoadingSkeleton width="47.5%" height={80} borderRadius={radius.md} />
            <LoadingSkeleton width="47.5%" height={80} borderRadius={radius.md} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: topInset + 8 }]}
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
        {/* Header Greeting */}
        <View style={styles.header}>
          <View style={styles.greetingCol}>
            <View style={styles.roomTagRow}>
              <Feather name="home" size={13} color={colors.primary} />
              <Text style={styles.roomBadge} numberOfLines={1}>
                {room?.name || 'Flat 302, Green Glen'}
              </Text>
            </View>
            <Text style={styles.greetingTitle}>
              {getGreeting(user?.name || '')}
            </Text>
          </View>
          <View style={styles.headerBadgesCol}>
            <View style={styles.headerBadgeRow}>
              <View style={styles.collectorBadge}>
                <Feather name="shield" size={12} color={colors.primary} />
                <Text style={styles.collectorText}>Collector: {collectorName}</Text>
              </View>
              <Pressable
                style={styles.bellButton}
                onPress={() => router.push('/activity-history')}
              >
                <Feather name="clock" size={16} color={colors.ink} />
              </Pressable>
              <Pressable
                style={styles.bellButton}
                onPress={() => router.push('/notifications')}
              >
                <Feather name="bell" size={16} color={colors.ink} />
                {unreadCount > 0 && (
                  <View style={styles.bellBadge}>
                    <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                )}
              </Pressable>
            </View>
            {isAdmin && pendingMembers.length > 0 && (
              <Pressable style={styles.pendingBadge} onPress={() => router.push('/(tabs)/room')}>
                <Feather name="user-plus" size={11} color={colors.warning} />
                <Text style={styles.pendingBadgeText}>{pendingMembers.length} Request</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Collector Action Alert Banner (if pending approvals exist) */}
        {isCollector && pendingConfirmations.length > 0 && (
          <Pressable
            style={styles.pendingAlertCard}
            onPress={() => router.push('/collector-confirmations')}
          >
            <View style={styles.pendingAlertIconWrap}>
              <Feather name="bell" size={16} color={colors.warning} />
            </View>
            <View style={styles.pendingAlertInfo}>
              <Text style={styles.pendingAlertTitle}>
                {pendingConfirmations.length} Payment Awaiting Confirmation
              </Text>
              <Text style={styles.pendingAlertSub}>
                Roommates marked payments as sent. Tap to verify.
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.warning} />
          </Pressable>
        )}

        {/* Hero Settlement Balance Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <Text style={styles.heroSub}>
              {isMyPaymentConfirmed
                ? 'Settlement Status'
                : isMyPaymentPending
                ? 'Payment Status'
                : 'Your Settlement Balance'}
            </Text>
            {isFinalized && (
              <View style={styles.finalizedTag}>
                <Feather name="lock" size={10} color={colors.primary} />
                <Text style={styles.finalizedTagText}>Finalized</Text>
              </View>
            )}
          </View>

          {/* Balance / Status Hero Body */}
          {isMyPaymentConfirmed ? (
            <View style={styles.heroSettledWrap}>
              <View style={styles.heroSettledIconWrap}>
                <Feather name="check-circle" size={28} color={colors.success} />
              </View>
              <View>
                <Text style={styles.heroSettledTitle}>All Settled Up!</Text>
                <Text style={styles.heroSettledSub}>
                  Share of {formatPaise(myPayment?.amountPaise || myNetOwedPaise)} confirmed
                </Text>
              </View>
            </View>
          ) : isMyPaymentPending ? (
            <View style={styles.heroSettledWrap}>
              <View style={[styles.heroSettledIconWrap, { backgroundColor: colors.warningSoft }]}>
                <Feather name="clock" size={28} color={colors.warning} />
              </View>
              <View>
                <Text style={[styles.heroSettledTitle, { color: colors.warning }]}>
                  Payment Sent
                </Text>
                <Text style={styles.heroSettledSub}>
                  {formatPaise(myPayment?.amountPaise || myNetOwedPaise)} awaiting collector confirmation
                </Text>
              </View>
            </View>
          ) : myNetOwedPaise > 0 ? (
            <View>
              <View style={styles.heroAmountRow}>
                <Text style={styles.heroStatusText}>You owe</Text>
                <Text style={[styles.heroAmount, { fontVariant: ['tabular-nums'] }]}>
                  {formatPaise(myNetOwedPaise)}
                </Text>
              </View>
              {Boolean(myStatement && myStatement.expensePaidPaise > 0) && (
                <Text style={styles.heroCreditNote}>
                  Upfront expense credit applied: -{formatPaise(myStatement?.expensePaidPaise || 0)}
                </Text>
              )}
            </View>
          ) : myNetOwedPaise < 0 ? (
            <View>
              <View style={styles.heroAmountRow}>
                <Text style={[styles.heroStatusText, { color: colors.success }]}>You get</Text>
                <Text style={[styles.heroAmount, { color: colors.success, fontVariant: ['tabular-nums'] }]}>
                  {formatPaise(Math.abs(myNetOwedPaise))}
                </Text>
              </View>
              <Text style={styles.heroCreditNote}>
                Paid more upfront than equal share. Collector will reimburse.
              </Text>
            </View>
          ) : (
            <View style={styles.heroSettledWrap}>
              <View style={styles.heroSettledIconWrap}>
                <Feather name="check" size={28} color={colors.success} />
              </View>
              <View>
                <Text style={styles.heroSettledTitle}>All Settled Up</Text>
                <Text style={styles.heroSettledSub}>Zero outstanding balance for this month</Text>
              </View>
            </View>
          )}

          {/* Hero Footer Actions */}
          <View style={styles.heroFooter}>
            <View style={styles.dueDateBadge}>
              <Feather
                name={isMyPaymentConfirmed ? 'check-circle' : 'calendar'}
                size={13}
                color={isMyPaymentConfirmed ? colors.success : colors.inkSecondary}
              />
              <Text style={styles.dueDateText}>
                {isMyPaymentConfirmed
                  ? 'Paid for this cycle'
                  : isMyPaymentPending
                  ? 'Sent to ' + collectorName
                  : getDueDaysText(room?.settlementDay || 30)}
              </Text>
            </View>

            {isMyPaymentConfirmed || isMyPaymentPending ? (
              <Pressable
                style={styles.receiptButton}
                onPress={() => router.push('/payment-history')}
              >
                <Text style={styles.receiptButtonText}>View Receipt</Text>
                <Feather name="chevron-right" size={14} color={colors.primary} />
              </Pressable>
            ) : myNetOwedPaise > 0 ? (
              <Pressable
                style={styles.payButton}
                onPress={() =>
                  router.push(
                    `/pay-settlement?settlementId=${currentSettlementId}&amountPaise=${myNetOwedPaise}`
                  )
                }
              >
                <Text style={styles.payButtonText}>
                  {isCollector ? 'Record My Share' : `Pay ${formatPaise(myNetOwedPaise)}`}
                </Text>
                <Feather name="arrow-up-right" size={15} color="#FFFFFF" />
              </Pressable>
            ) : (
              <Pressable
                style={styles.receiptButton}
                onPress={() => router.push('/statement-detail')}
              >
                <Text style={styles.receiptButtonText}>View Statement</Text>
                <Feather name="chevron-right" size={14} color={colors.primary} />
              </Pressable>
            )}
          </View>

          {/* Collector Collection Progress Strip */}
          {isCollector && (
            <View style={styles.collectorProgressStrip}>
              <View style={styles.collectorProgressHeader}>
                <Text style={styles.collectorProgressLabel}>Room Collection Progress</Text>
                <Text style={styles.collectorProgressPercent}>{progressPercent}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressBar, { width: `${progressPercent}%` }]} />
              </View>
              <Text style={styles.collectorProgressSub}>
                {formatPaise(totalPaidPaise)} collected of {formatPaise(totalDuePaise)}
              </Text>
            </View>
          )}
        </View>

        {/* 2-up Metric Cards */}
        <View style={styles.twoUpGrid}>
          {/* Card 1: Room Expenses */}
          <Pressable
            style={styles.miniCard}
            onPress={() => router.push('/(tabs)/expenses')}
          >
            <View style={styles.miniCardHeader}>
              <Text style={styles.miniCardLabel}>Room Expenses</Text>
              <Feather name="trending-up" size={15} color={colors.primary} />
            </View>
            <Text style={[styles.miniCardValue, { fontVariant: ['tabular-nums'] }]}>
              {formatPaise(totalMonthExpensesPaise)}
            </Text>
            <Text style={styles.miniCardSub}>
              {expenses.length} shared · {waterDeliveries.length} water cans
            </Text>
          </Pressable>

          {/* Card 2: Monthly Rent */}
          <Pressable
            style={styles.miniCard}
            onPress={() =>
              isCollector && !isLandlordPaid
                ? router.push('/pay-landlord')
                : router.push('/payment-history')
            }
          >
            <View style={styles.miniCardHeader}>
              <Text style={styles.miniCardLabel}>Monthly Rent</Text>
              <Feather
                name={isLandlordPaid ? 'check-circle' : 'home'}
                size={15}
                color={isLandlordPaid ? colors.success : colors.warning}
              />
            </View>
            <Text style={[styles.miniCardValue, { fontVariant: ['tabular-nums'] }]}>
              {formatPaise(monthlyRentPaise)}
            </Text>
            <View style={styles.rentStatusRow}>
              <Text style={styles.miniCardSub}>{formatPaise(perPersonRentPaise)} / person</Text>
              <View
                style={[
                  styles.landlordStatusPill,
                  isLandlordPaid ? styles.landlordPaidPill : styles.landlordPendingPill,
                ]}
              >
                <Text
                  style={[
                    styles.landlordStatusText,
                    isLandlordPaid ? styles.landlordPaidText : styles.landlordPendingText,
                  ]}
                >
                  {isLandlordPaid ? 'Paid' : 'Pending'}
                </Text>
              </View>
            </View>
          </Pressable>
        </View>

        {/* Quick Actions (2x2 Grid) */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionGrid}>
          {/* Tile 1: Add Expense */}
          <Pressable
            style={({ pressed }) => [styles.actionTile, pressed && styles.actionTilePressed]}
            onPress={() => router.push('/add-expense')}
          >
            <View style={[styles.actionIconWrapper, { backgroundColor: colors.primarySoft }]}>
              <Feather name="plus-circle" size={22} color={colors.primary} />
            </View>
            <Text style={styles.actionLabel}>Add Expense</Text>
            <Text style={styles.actionSubtext}>Split bills equally</Text>
          </Pressable>

          {/* Tile 2: Water Delivery */}
          <Pressable
            style={({ pressed }) => [styles.actionTile, pressed && styles.actionTilePressed]}
            onPress={() => router.push('/water-delivery')}
          >
            <View style={[styles.actionIconWrapper, { backgroundColor: '#E0F2FE' }]}>
              <Feather name="droplet" size={22} color="#0284C7" />
            </View>
            <Text style={styles.actionLabel}>Water Delivery</Text>
            <Text style={styles.actionSubtext}>1-touch log can</Text>
          </Pressable>

          {/* Tile 3: Payments */}
          <Pressable
            style={({ pressed }) => [styles.actionTile, pressed && styles.actionTilePressed]}
            onPress={() => router.push('/payment-history')}
          >
            <View style={[styles.actionIconWrapper, { backgroundColor: colors.successSoft }]}>
              <Feather name="check-circle" size={22} color={colors.success} />
            </View>
            <Text style={styles.actionLabel}>Payments</Text>
            <Text style={styles.actionSubtext}>View receipts</Text>
          </Pressable>

          {/* Tile 4: Report / Statement */}
          <Pressable
            style={({ pressed }) => [styles.actionTile, pressed && styles.actionTilePressed]}
            onPress={() => router.push('/reports')}
          >
            <View style={[styles.actionIconWrapper, { backgroundColor: colors.warningSoft }]}>
              <Feather name="pie-chart" size={22} color={colors.warning} />
            </View>
            <Text style={styles.actionLabel}>Reports</Text>
            <Text style={styles.actionSubtext}>Monthly & compare</Text>
          </Pressable>
        </View>

        {/* Roommate Payment Status Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Roommate Payment Status</Text>
          <Pressable onPress={() => router.push('/(tabs)/settlement')}>
            <Text style={styles.seeAllLink}>Settlement Tab →</Text>
          </Pressable>
        </View>

        <View style={styles.roommateList}>
          {(statement?.memberStatements && statement.memberStatements.length > 0
            ? statement.memberStatements
            : activeMembers.map((m) => ({
                userId: m.userId,
                name: m.name,
                status: 'active' as const,
                rentSharePaise: perPersonRentPaise,
                expenseSharePaise: 0,
                expensePaidPaise: 0,
                carriedForwardPaise: 0,
                adjustmentPaise: 0,
                totalSharePaise: perPersonRentPaise,
                netAmountOwedPaise: perPersonRentPaise,
              }))
          ).map((m, idx) => {
            const isMe = m.userId === user?.id;
            const isMemberCollector = m.userId === room?.collectorId;
            const isMemberAdmin = m.userId === room?.adminId;

            // Find payment record for this roommate
            const memberPayment = payments.find(
              (p: PaymentItem) =>
                (p.settlementId === currentSettlementId || p.settlementId === `set-${selectedPeriod}-flat302`) &&
                p.payerUserId === m.userId &&
                p.status !== 'cancelled'
            );

            const isPaid = memberPayment?.status === 'confirmed';
            const isPending = memberPayment?.status === 'sent';

            return (
              <View key={m.userId || idx} style={[styles.roommateRow, idx > 0 && styles.roommateBorder]}>
                <Avatar name={m.name} size="sm" />
                <View style={styles.roommateInfo}>
                  <View style={styles.roommateNameRow}>
                    <Text style={styles.roommateName} numberOfLines={1}>
                      {m.name} {isMe ? '(You)' : ''}
                    </Text>
                    {isMemberCollector && (
                      <View style={styles.roleTag}>
                        <Text style={styles.roleTagText}>Collector</Text>
                      </View>
                    )}
                    {isMemberAdmin && !isMemberCollector && (
                      <View style={[styles.roleTag, { backgroundColor: '#F1F5F9' }]}>
                        <Text style={[styles.roleTagText, { color: colors.inkSecondary }]}>Admin</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.roommateShare}>
                    {m.expensePaidPaise > 0
                      ? `Paid ₹${(m.expensePaidPaise / 100).toLocaleString('en-IN')} upfront`
                      : 'No upfront expenses'}
                  </Text>
                </View>

                <View style={styles.roommateAmountCol}>
                  <Text style={[styles.roommateAmount, { fontVariant: ['tabular-nums'] }]}>
                    {formatPaise(m.netAmountOwedPaise)}
                  </Text>
                  {isPaid ? (
                    <StatusPill status="confirmed" customLabel="Confirmed" />
                  ) : isPending ? (
                    <StatusPill status="awaiting" customLabel="Sent" />
                  ) : m.netAmountOwedPaise > 0 ? (
                    <StatusPill status="pending" customLabel="Pending" />
                  ) : (
                    <StatusPill status="settled" customLabel="Settled" />
                  )}
                </View>
              </View>
            );
          })}

          {/* Footer Statement Link inside Card */}
          <Pressable
            style={styles.roommateCardFooter}
            onPress={() => router.push('/statement-detail')}
          >
            <Text style={styles.roommateCardFooterText}>View Full Itemized Statement</Text>
            <Feather name="arrow-right" size={14} color={colors.primary} />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: space.lg,
  },
  greetingCol: {
    flex: 1,
    marginRight: space.sm,
  },
  roomTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  roomBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 2,
  },
  headerBadgesCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  headerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bellButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.danger,
    borderRadius: 8,
    minWidth: 15,
    height: 15,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  collectorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm + 2,
    paddingVertical: space.xs,
  },
  collectorText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.inkSecondary,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  pendingBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.warning,
  },
  pendingAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningSoft,
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.md,
    gap: space.sm,
  },
  pendingAlertIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingAlertInfo: {
    flex: 1,
  },
  pendingAlertTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  pendingAlertSub: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 1,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    borderColor: colors.border,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
    marginBottom: space.lg,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.xs,
  },
  heroSub: {
    fontSize: 12,
    color: colors.inkSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  finalizedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  finalizedTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  heroAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: space.xs,
    marginBottom: space.xs,
  },
  heroStatusText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.danger,
    marginRight: space.xs,
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.danger,
  },
  heroCreditNote: {
    fontSize: 12,
    color: colors.success,
    fontWeight: '500',
    marginBottom: space.sm,
  },
  heroSettledWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    marginBottom: space.xs,
  },
  heroSettledIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSettledTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.success,
  },
  heroSettledSub: {
    fontSize: 12,
    color: colors.inkSecondary,
    marginTop: 2,
  },
  heroFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
    paddingTop: space.md,
    marginTop: space.xs,
  },
  dueDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dueDateText: {
    fontSize: 12,
    color: colors.inkSecondary,
    fontWeight: '500',
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    gap: 4,
  },
  payButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  receiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    gap: 3,
  },
  receiptButtonText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 12,
  },
  collectorProgressStrip: {
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
  },
  collectorProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  collectorProgressLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.inkSecondary,
  },
  collectorProgressPercent: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
  },
  collectorProgressSub: {
    fontSize: 11,
    color: colors.inkTertiary,
    marginTop: 4,
  },
  twoUpGrid: {
    flexDirection: 'row',
    gap: space.md,
    marginBottom: space.lg,
  },
  miniCard: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: space.md,
    borderRadius: radius.md,
    borderColor: colors.border,
    borderWidth: 1,
  },
  miniCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.xs,
  },
  miniCardLabel: {
    fontSize: 12,
    color: colors.inkSecondary,
    fontWeight: '500',
  },
  miniCardValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  miniCardSub: {
    fontSize: 11,
    color: colors.inkTertiary,
    marginTop: 2,
  },
  rentStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  landlordStatusPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  landlordPaidPill: {
    backgroundColor: colors.successSoft,
  },
  landlordPendingPill: {
    backgroundColor: colors.warningSoft,
  },
  landlordStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  landlordPaidText: {
    color: colors.success,
  },
  landlordPendingText: {
    color: colors.warning,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: space.sm,
  },
  seeAllLink: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
    marginBottom: space.lg,
  },
  actionTile: {
    width: '47.5%',
    backgroundColor: colors.surface,
    padding: space.md,
    borderRadius: radius.md,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
  },
  actionTilePressed: {
    backgroundColor: colors.surfaceMuted,
  },
  actionIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  actionSubtext: {
    fontSize: 10,
    color: colors.inkTertiary,
    marginTop: 1,
  },
  roommateList: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderColor: colors.border,
    borderWidth: 1,
    overflow: 'hidden',
  },
  roommateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
  },
  roommateBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
  },
  roommateInfo: {
    flex: 1,
    marginLeft: space.sm,
  },
  roommateNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roommateName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  roleTag: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  roleTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.primary,
  },
  roommateShare: {
    fontSize: 11,
    color: colors.inkSecondary,
    marginTop: 1,
  },
  roommateAmountCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  roommateAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  roommateCardFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: space.sm + 2,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
    backgroundColor: colors.surfaceMuted,
    gap: 4,
  },
  roommateCardFooterText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
});
