import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Pressable,
  RefreshControl,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Card, Button, Avatar } from '../../components/ui';
import { colors, space, radius } from '../../lib/tokens';
import { useAuth } from '../../context/AuthContext';
import { useRoom } from '../../context/RoomContext';
import { useSettlement } from '../../context/SettlementContext';
import { usePayments } from '../../context/PaymentContext';
import { formatPaise } from '../../lib/utils';

export default function SettlementScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { room, activeMembers } = useRoom();
  const {
    settlement,
    statement,
    memberShares,
    selectedPeriod,
    setSelectedPeriod,
    isFinalized,
    isLoading,
    refreshSettlement,
  } = useSettlement();
  const { payments, pendingConfirmations, landlordPayments, refreshPayments } = usePayments();

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshSettlement(), refreshPayments()]);
    setRefreshing(false);
  };

  const changeMonth = (delta: number) => {
    const [yearStr, monthStr] = selectedPeriod.split('-');
    let year = parseInt(yearStr, 10);
    let month = parseInt(monthStr, 10) + delta;

    if (month > 12) {
      month = 1;
      year += 1;
    } else if (month < 1) {
      month = 12;
      year -= 1;
    }

    const newPeriod = `${year}-${month.toString().padStart(2, '0')}`;
    setSelectedPeriod(newPeriod);
  };

  const formatPeriodDisplay = (periodStr: string) => {
    const [year, month] = periodStr.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const isCollector = user?.id === room?.collectorId;
  const isAdmin = user?.id === room?.adminId;

  // Find logged in user's statement
  const myStatement = statement?.memberStatements.find((m) => m.userId === user?.id);

  // Find my payment record for this settlement
  const currentSettlementId = settlement?.id || `set-${selectedPeriod}-flat302`;
  const myPayment = payments.find(
    (p) =>
      (p.settlementId === currentSettlementId || p.settlementId === `set-${selectedPeriod}-flat302`) &&
      p.payerUserId === user?.id &&
      p.status !== 'cancelled'
  );

  const isMyPaymentConfirmed = myPayment?.status === 'confirmed';
  const isMyPaymentPending = myPayment?.status === 'sent';

  // Calculate collection progress
  const totalDuePaise = memberShares.reduce((sum, s) => sum + Math.max(s.amountOwedPaise, 0), 0);
  const totalPaidPaise = memberShares.reduce((sum, s) => sum + s.amountPaidPaise, 0);
  const progressPercent =
    totalDuePaise > 0
      ? Math.min(Math.round((totalPaidPaise / totalDuePaise) * 100), 100)
      : isFinalized
      ? 100
      : 0;

  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (RNStatusBar.currentHeight || 28) : 0,
    24
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header with status bar clearance */}
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <View style={styles.headerTitleCol}>
          <Text style={styles.title} numberOfLines={1}>Settlement</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {room?.name || 'Flat 302, Green Glen'} • {formatPeriodDisplay(selectedPeriod)}
          </Text>
        </View>

        <View style={styles.headerRightBtns}>
          <Pressable
            style={styles.ledgerBtn}
            onPress={() => router.push('/payment-history')}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          >
            <Feather name="clock" size={13} color={colors.ink} />
            <Text style={styles.ledgerBtnText}>Ledger</Text>
          </Pressable>

          <Pressable
            style={styles.statementBtn}
            onPress={() => router.push(`/statement-detail?period=${selectedPeriod}`)}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          >
            <Feather name="file-text" size={13} color={colors.primary} />
            <Text style={styles.statementBtnText}>Statement</Text>
          </Pressable>
        </View>
      </View>

      {/* Month Switcher Sticky Bar */}
      <View style={styles.monthBar}>
        <Pressable style={styles.monthArrow} onPress={() => changeMonth(-1)}>
          <Feather name="chevron-left" size={20} color={colors.ink} />
        </Pressable>

        <View style={styles.monthDisplay}>
          <Feather name="calendar" size={14} color={colors.primary} />
          <Text style={styles.monthText}>{formatPeriodDisplay(selectedPeriod)}</Text>
        </View>

        <Pressable style={styles.monthArrow} onPress={() => changeMonth(1)}>
          <Feather name="chevron-right" size={20} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Collector Pending Confirmation Banner */}
        {isCollector && pendingConfirmations.length > 0 && (
          <Pressable
            style={styles.pendingConfirmationsBanner}
            onPress={() => router.push('/collector-confirmations')}
          >
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeCount}>{pendingConfirmations.length}</Text>
            </View>
            <View style={styles.pendingBannerTextCol}>
              <Text style={styles.pendingBannerTitle}>Payments Awaiting Confirmation</Text>
              <Text style={styles.pendingBannerDesc}>
                {pendingConfirmations.length} roommate payment{pendingConfirmations.length > 1 ? 's' : ''} sent. Tap to verify & confirm.
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.warning} />
          </Pressable>
        )}

        {/* Status Pill Card */}
        <View
          style={[
            styles.statusBanner,
            isFinalized ? styles.statusBannerFinalized : styles.statusBannerDraft,
          ]}
        >
          <Feather
            name={isFinalized ? 'check-circle' : 'clock'}
            size={16}
            color={isFinalized ? colors.success : colors.warning}
          />
          <View style={styles.statusBannerTextCol}>
            <Text
              style={[
                styles.statusBannerTitle,
                { color: isFinalized ? colors.success : colors.warning },
              ]}
            >
              {isFinalized ? 'Settlement Finalized & Locked' : 'Draft • Real-Time Running Split'}
            </Text>
            <Text style={styles.statusBannerDesc}>
              {isFinalized
                ? `Finalized on ${settlement?.finalizedAt ? new Date(settlement.finalizedAt).toLocaleDateString() : 'End of Month'} by ${settlement?.finalizedByName || 'Admin'}`
                : 'Amounts update live as expenses are added. Ready to review and finalize.'}
            </Text>
          </View>
        </View>

        {/* Room Statement Card */}
        <Card style={styles.statementCard}>
          <View style={styles.statementHeader}>
            <View>
              <Text style={styles.statementTag}>ROOM SETTLEMENT STATEMENT</Text>
              <Text style={styles.statementMonth}>{formatPeriodDisplay(selectedPeriod)}</Text>
            </View>
            <View
              style={[
                styles.badge,
                { backgroundColor: isFinalized ? colors.successSoft : colors.warningSoft },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  { color: isFinalized ? colors.success : colors.warning },
                ]}
              >
                {isFinalized ? 'Finalized' : 'Draft'}
              </Text>
            </View>
          </View>

          {/* Breakdown Lines */}
          <View style={styles.lines}>
            <View style={styles.lineRow}>
              <Text style={styles.lineLabel}>Monthly Room Rent</Text>
              <Text style={[styles.lineValue, { fontVariant: ['tabular-nums'] }]}>
                {formatPaise(statement?.totalRentPaise || room?.monthlyRentPaise || 2800000)}
              </Text>
            </View>

            <View style={styles.lineRow}>
              <Text style={styles.lineLabel}>Shared Flat Expenses</Text>
              <Text style={[styles.lineValue, { fontVariant: ['tabular-nums'] }]}>
                {formatPaise(statement?.totalExpensesPaise || 0)}
              </Text>
            </View>

            {Boolean(statement?.totalCarriedForwardPaise) && (
              <View style={styles.lineRow}>
                <Text style={styles.lineLabel}>Carried Forward Dues</Text>
                <Text style={[styles.lineValue, { fontVariant: ['tabular-nums'] }]}>
                  {formatPaise(statement?.totalCarriedForwardPaise || 0)}
                </Text>
              </View>
            )}

            <View style={[styles.lineRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total Room Amount</Text>
              <Text style={[styles.totalValue, { fontVariant: ['tabular-nums'] }]}>
                {formatPaise(statement?.grandTotalPaise || 2800000)}
              </Text>
            </View>
          </View>

          {/* Personal Share Box */}
          <View style={styles.personalShareBox}>
            <View style={styles.personalShareHeaderRow}>
              <Text style={styles.personalShareTitle}>
                Your Equal Share (1/{statement?.memberCount || 4})
              </Text>
              <Text style={[styles.personalShareAmount, { fontVariant: ['tabular-nums'] }]}>
                {formatPaise(myStatement?.totalSharePaise || 700000)}
              </Text>
            </View>

            {Boolean(myStatement?.expensePaidPaise) && (
              <Text style={styles.personalPaidCredit}>
                Paid upfront for shared expenses: -{formatPaise(myStatement?.expensePaidPaise || 0)}
              </Text>
            )}

            <View style={styles.netOwedRow}>
              <Text style={styles.netOwedLabel}>Net Amount You Owe:</Text>
              <Text style={[styles.netOwedAmount, { fontVariant: ['tabular-nums'] }]}>
                {formatPaise(myStatement?.netAmountOwedPaise || 700000)}
              </Text>
            </View>
          </View>

          {/* Action Area: Pay Collector / Status / Finalize */}
          {isMyPaymentConfirmed ? (
            <View style={styles.clearedBanner}>
              <Feather name="check-circle" size={18} color={colors.success} />
              <View style={styles.clearedTextCol}>
                <Text style={styles.clearedTitle}>Settlement Fully Cleared</Text>
                <Text style={styles.clearedDesc}>
                  Your payment of {formatPaise(myStatement?.netAmountOwedPaise || 700000)} has been
                  confirmed.
                </Text>
              </View>
              <Pressable
                style={styles.viewReceiptBtn}
                onPress={() => router.push('/payment-history')}
              >
                <Text style={styles.viewReceiptText}>Ledger</Text>
              </Pressable>
            </View>
          ) : isMyPaymentPending ? (
            <View style={styles.pendingPaymentBanner}>
              <Feather name="clock" size={18} color={colors.warning} />
              <View style={styles.clearedTextCol}>
                <Text style={styles.pendingPaymentTitle}>Payment Pending Confirmation</Text>
                <Text style={styles.pendingPaymentDesc}>
                  Marked as sent • Awaiting Rent Collector verification.
                </Text>
              </View>
              <Pressable
                style={styles.viewReceiptBtn}
                onPress={() => router.push('/payment-history')}
              >
                <Text style={styles.viewReceiptText}>Details</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={styles.payBtn}
              onPress={() =>
                router.push(
                  `/pay-settlement?settlementId=${currentSettlementId}&amountPaise=${myStatement?.netAmountOwedPaise || 700000}`
                )
              }
            >
              <Feather name="arrow-up-right" size={16} color="#FFFFFF" />
              <Text style={styles.payBtnText}>
                {isCollector
                  ? `Pay / Record My Share (${formatPaise(myStatement?.netAmountOwedPaise || 700000)})`
                  : `Pay Collector ${formatPaise(myStatement?.netAmountOwedPaise || 700000)}`}
              </Text>
            </Pressable>
          )}

          {/* If period is in Draft and user is Admin/Collector, show Finalize button below */}
          {!isFinalized && (isAdmin || isCollector) && (
            <Pressable
              style={styles.finalizeOutlineBtn}
              onPress={() => router.push(`/finalize-modal?period=${selectedPeriod}`)}
            >
              <Feather name="lock" size={14} color={colors.primary} />
              <Text style={styles.finalizeOutlineText}>Lock & Finalize Settlement</Text>
            </Pressable>
          )}
        </Card>

        {/* Collector Management Controls */}
        {isCollector && (
          <Card style={styles.collectorCard}>
            <View style={styles.collectorCardHeader}>
              <Feather name="briefcase" size={16} color={colors.primary} />
              <Text style={styles.collectorCardTitle}>Collector Management Tools</Text>
            </View>
            <View style={styles.collectorBtnRow}>
              <Pressable
                style={styles.collectorBtn}
                onPress={() => router.push('/collector-confirmations')}
              >
                <Feather name="check-square" size={16} color={colors.ink} />
                <Text style={styles.collectorBtnText}>Confirmations</Text>
                {pendingConfirmations.length > 0 && (
                  <View style={styles.miniPill}>
                    <Text style={styles.miniPillText}>{pendingConfirmations.length}</Text>
                  </View>
                )}
              </Pressable>

              <Pressable
                style={styles.collectorBtn}
                onPress={() => router.push('/pay-landlord')}
              >
                <Feather name="home" size={16} color={colors.ink} />
                <Text style={styles.collectorBtnText}>Disburse Rent</Text>
              </Pressable>
            </View>
          </Card>
        )}

        {/* Collection Progress Card */}
        <Text style={styles.sectionTitle}>Collection Progress</Text>
        <Card style={styles.progressCard}>
          <View style={styles.progressTopRow}>
            <View>
              <Text style={styles.progressLabel}>Collected by Rent Collector</Text>
              <Text style={styles.progressNumbers}>
                {formatPaise(totalPaidPaise)} of {formatPaise(totalDuePaise || 2800000)}
              </Text>
            </View>
            <View style={styles.percentPill}>
              <Text style={styles.percentPillText}>{progressPercent}%</Text>
            </View>
          </View>

          {/* Progress Bar Track */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressBar, { width: `${progressPercent}%` }]} />
          </View>

          <Text style={styles.progressSubtext}>
            {progressPercent === 100
              ? 'All roommates have paid their full monthly settlement.'
              : `${memberShares.filter((s) => s.amountPaidPaise >= s.amountOwedPaise && s.amountOwedPaise > 0).length} of ${memberShares.length} roommates fully cleared.`}
          </Text>
        </Card>

        {/* Roommate Net Share Breakdown */}
        <Text style={styles.sectionTitle}>Roommate Settlement Roster</Text>
        <Card style={styles.rosterCard}>
          {(statement?.memberStatements || []).map((m, idx) => {
            const isMe = m.userId === user?.id;

            // Check if member has payment record
            const memberPayment = payments.find(
              (p) =>
                (p.settlementId === currentSettlementId || p.settlementId === `set-${selectedPeriod}-flat302`) &&
                p.payerUserId === m.userId &&
                p.status !== 'cancelled'
            );

            const isPaid = memberPayment?.status === 'confirmed';
            const isPending = memberPayment?.status === 'sent';

            return (
              <View key={m.userId || idx} style={[styles.rosterRow, idx > 0 && styles.rosterBorder]}>
                <Avatar name={m.name} size="sm" />
                <View style={styles.rosterInfo}>
                  <Text style={styles.rosterName}>
                    {m.name} {isMe ? '(You)' : ''}
                  </Text>
                  <Text style={styles.rosterSub}>
                    {m.expensePaidPaise > 0
                      ? `Paid ₹${(m.expensePaidPaise / 100).toLocaleString('en-IN')} upfront`
                      : 'No upfront expenses'}
                  </Text>
                </View>

                <View style={styles.rosterAmountCol}>
                  <Text style={[styles.rosterAmount, { fontVariant: ['tabular-nums'] }]}>
                    {formatPaise(m.netAmountOwedPaise)}
                  </Text>
                  <View
                    style={[
                      styles.rosterStatusPill,
                      isPaid
                        ? styles.pillPaid
                        : isPending
                        ? styles.pillSent
                        : styles.pillPending,
                    ]}
                  >
                    <Text
                      style={[
                        styles.rosterStatusText,
                        {
                          color: isPaid
                            ? colors.success
                            : isPending
                            ? colors.primary
                            : colors.warning,
                        },
                      ]}
                    >
                      {isPaid ? 'Paid' : isPending ? 'Pending' : 'Unpaid'}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingBottom: space.sm + 4,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitleCol: { flex: 1, marginRight: space.sm },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink },
  subtitle: { fontSize: 11, color: colors.inkSecondary, marginTop: 2 },
  headerRightBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  ledgerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm + 4,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  ledgerBtnText: { color: colors.ink, fontSize: 12, fontWeight: '700' },

  statementBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm + 4,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    gap: 4,
  },
  statementBtnText: { color: colors.primary, fontSize: 12, fontWeight: '700' },

  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  monthArrow: { padding: space.xs },
  monthDisplay: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  monthText: { fontSize: 14, fontWeight: '700', color: colors.ink },

  container: { padding: space.lg, paddingBottom: 60 },

  pendingConfirmationsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningSoft,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warning,
    marginBottom: space.md,
    gap: space.sm,
  },
  pendingBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingBadgeCount: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  pendingBannerTextCol: { flex: 1 },
  pendingBannerTitle: { fontSize: 13, fontWeight: '700', color: colors.ink },
  pendingBannerDesc: { fontSize: 11, color: colors.inkSecondary, marginTop: 2 },

  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: space.md,
    gap: space.sm,
  },
  statusBannerDraft: { backgroundColor: colors.warningSoft, borderColor: colors.warning },
  statusBannerFinalized: { backgroundColor: colors.successSoft, borderColor: colors.success },
  statusBannerTextCol: { flex: 1 },
  statusBannerTitle: { fontSize: 13, fontWeight: '700' },
  statusBannerDesc: { fontSize: 11, color: colors.inkSecondary, marginTop: 2 },

  statementCard: { padding: space.md + 2, marginBottom: space.md },
  statementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: space.md,
  },
  statementTag: { fontSize: 10, fontWeight: '700', color: colors.inkSecondary, letterSpacing: 0.5 },
  statementMonth: { fontSize: 18, fontWeight: '800', color: colors.ink, marginTop: 2 },
  badge: { paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { fontSize: 11, fontWeight: '700' },

  lines: { marginBottom: space.md },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  lineLabel: { fontSize: 13, color: colors.inkSecondary },
  lineValue: { fontSize: 13, fontWeight: '600', color: colors.ink },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.sm, marginTop: 4 },
  totalLabel: { fontSize: 14, fontWeight: '700', color: colors.ink },
  totalValue: { fontSize: 15, fontWeight: '800', color: colors.ink },

  personalShareBox: {
    backgroundColor: colors.surfaceMuted,
    padding: space.md,
    borderRadius: radius.md,
    marginBottom: space.md,
  },
  personalShareHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  personalShareTitle: { fontSize: 13, fontWeight: '600', color: colors.inkSecondary },
  personalShareAmount: { fontSize: 15, fontWeight: '700', color: colors.ink },
  personalPaidCredit: { fontSize: 11, color: colors.success, marginTop: 4, fontWeight: '600' },
  netOwedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: space.sm,
    marginTop: space.sm,
  },
  netOwedLabel: { fontSize: 14, fontWeight: '700', color: colors.ink },
  netOwedAmount: { fontSize: 18, fontWeight: '800', color: colors.primary },

  finalizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: space.md,
    borderRadius: radius.md,
    gap: space.xs,
  },
  finalizeBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: space.md,
    borderRadius: radius.md,
    gap: space.xs,
  },
  payBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  clearedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successSoft,
    padding: space.md,
    borderRadius: radius.md,
    gap: space.sm,
  },
  clearedTextCol: { flex: 1 },
  clearedTitle: { fontSize: 13, fontWeight: '700', color: colors.success },
  clearedDesc: { fontSize: 11, color: colors.inkSecondary, marginTop: 2 },

  pendingPaymentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningSoft,
    padding: space.md,
    borderRadius: radius.md,
    gap: space.sm,
  },
  pendingPaymentTitle: { fontSize: 13, fontWeight: '700', color: colors.warning },
  pendingPaymentDesc: { fontSize: 11, color: colors.inkSecondary, marginTop: 2 },

  collectorCard: { padding: space.md, marginBottom: space.md },
  collectorCardHeader: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginBottom: space.sm },
  collectorCardTitle: { fontSize: 12, fontWeight: '700', color: colors.inkSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  collectorBtnRow: { flexDirection: 'row', gap: space.sm },
  collectorBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  collectorBtnText: { fontSize: 12, fontWeight: '700', color: colors.ink },
  miniPill: {
    backgroundColor: colors.warning,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  miniPillText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },

  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.inkSecondary, textTransform: 'uppercase', marginBottom: space.xs },

  progressCard: { padding: space.md, marginBottom: space.lg },
  progressTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.sm },
  progressLabel: { fontSize: 11, fontWeight: '600', color: colors.inkSecondary },
  progressNumbers: { fontSize: 15, fontWeight: '800', color: colors.ink, marginTop: 2 },
  percentPill: { backgroundColor: colors.primarySoft, paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.pill },
  percentPillText: { fontSize: 12, fontWeight: '800', color: colors.primary },
  progressTrack: { height: 8, backgroundColor: colors.surfaceMuted, borderRadius: 4, overflow: 'hidden', marginBottom: space.xs },
  progressBar: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
  progressSubtext: { fontSize: 11, color: colors.inkSecondary, marginTop: 2 },

  rosterCard: { padding: 0, overflow: 'hidden' },
  rosterRow: { flexDirection: 'row', alignItems: 'center', padding: space.md },
  rosterBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  rosterInfo: { flex: 1, marginLeft: space.md },
  rosterName: { fontSize: 14, fontWeight: '600', color: colors.ink },
  rosterSub: { fontSize: 11, color: colors.inkSecondary, marginTop: 2 },
  rosterAmountCol: { alignItems: 'flex-end' },
  rosterAmount: { fontSize: 15, fontWeight: '700', color: colors.ink },
  rosterStatusPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, marginTop: 2 },
  pillPaid: { backgroundColor: colors.successSoft },
  pillSent: { backgroundColor: colors.primarySoft },
  pillPending: { backgroundColor: colors.warningSoft },
  rosterStatusText: { fontSize: 10, fontWeight: '700' },
  viewReceiptBtn: {
    paddingHorizontal: space.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  viewReceiptText: { fontSize: 11, fontWeight: '700', color: colors.ink },
  finalizeOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    paddingVertical: space.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: space.sm,
    gap: space.xs,
  },
  finalizeOutlineText: { fontSize: 13, fontWeight: '600', color: colors.ink },
});
