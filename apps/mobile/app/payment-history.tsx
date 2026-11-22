import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Pressable,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Card, Button, Avatar, EmptyState } from '../components/ui';
import { colors, space, radius } from '../lib/tokens';
import { usePayments, PaymentItem, LandlordPaymentItem } from '../context/PaymentContext';
import { useSettlement } from '../context/SettlementContext';
import { useAuth } from '../context/AuthContext';
import { useRoom } from '../context/RoomContext';
import { formatPaise } from '../lib/utils';

export default function PaymentHistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { room } = useRoom();
  const { payments, landlordPayments, reversePayment, refreshPayments, isLoading } = usePayments();
  const { refreshSettlement } = useSettlement();

  const [activeTab, setActiveTab] = useState<'all' | 'roommates' | 'landlord'>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Reversal modal state
  const [reversalModalVisible, setReversalModalVisible] = useState(false);
  const [selectedPaymentForReversal, setSelectedPaymentForReversal] = useState<PaymentItem | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [isSubmittingReversal, setIsSubmittingReversal] = useState(false);

  const isCollectorOrAdmin = user?.id === room?.collectorId || user?.id === room?.adminId;

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshPayments();
    await refreshSettlement();
    setRefreshing(false);
  };

  const handleOpenReversal = (payment: PaymentItem) => {
    setSelectedPaymentForReversal(payment);
    setReversalReason('');
    setReversalModalVisible(true);
  };

  const handleConfirmReversal = async () => {
    if (!selectedPaymentForReversal) return;
    if (reversalReason.trim().length < 3) {
      Alert.alert('Reason Required', 'Please provide an audit reason of at least 3 characters.');
      return;
    }

    setIsSubmittingReversal(true);
    try {
      const res = await reversePayment(selectedPaymentForReversal.id, reversalReason.trim());
      if (res.success) {
        setReversalModalVisible(false);
        Alert.alert('Payment Reversed', 'The payment has been reversed and dues restored.');
      } else {
        Alert.alert('Error', res.error || 'Failed to reverse payment');
      }
    } finally {
      setIsSubmittingReversal(false);
    }
  };

  const getStatusStyle = (status: PaymentItem['status']) => {
    switch (status) {
      case 'confirmed':
        return { bg: colors.successSoft, text: colors.success, label: 'Confirmed' };
      case 'sent':
        return { bg: colors.warningSoft, text: colors.warning, label: 'Pending Confirmation' };
      case 'reversed':
        return { bg: colors.dangerSoft, text: colors.danger, label: 'Reversed' };
      case 'cancelled':
        return { bg: colors.surfaceMuted, text: colors.inkSecondary, label: 'Cancelled' };
    }
  };

  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (RNStatusBar.currentHeight || 28) : 0,
    24
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Payment Ledger</Text>
          <Text style={styles.headerSubtitle}>
            {room?.name || 'Flat 302'} • Complete Audit History
          </Text>
        </View>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Feather name="x" size={22} color={colors.inkSecondary} />
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tabItem, activeTab === 'all' && styles.tabItemActive]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
            All ({payments.length + landlordPayments.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabItem, activeTab === 'roommates' && styles.tabItemActive]}
          onPress={() => setActiveTab('roommates')}
        >
          <Text style={[styles.tabText, activeTab === 'roommates' && styles.tabTextActive]}>
            Roommates ({payments.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabItem, activeTab === 'landlord' && styles.tabItemActive]}
          onPress={() => setActiveTab('landlord')}
        >
          <Text style={[styles.tabText, activeTab === 'landlord' && styles.tabTextActive]}>
            Landlord Rent ({landlordPayments.length})
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Roommate Payments List */}
        {(activeTab === 'all' || activeTab === 'roommates') && (
          <View style={styles.section}>
            {activeTab === 'all' && <Text style={styles.sectionHeader}>ROOMMATE COLLECTIONS</Text>}
            {payments.length === 0 ? (
              <EmptyState
                icon="inbox"
                title="No Roommate Payments"
                description="Payments made by roommates will appear here."
              />
            ) : (
              payments.map((p) => {
                const s = getStatusStyle(p.status);
                const dateStr = new Date(p.sentAt).toLocaleDateString('en-IN', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });

                return (
                  <Card key={p.id} style={styles.card}>
                    <View style={styles.cardRow}>
                      <Avatar name={p.payerName} size="md" />
                      <View style={styles.cardInfo}>
                        <View style={styles.nameRow}>
                          <Text style={styles.payerName}>{p.payerName}</Text>
                          <Feather name="arrow-right" size={12} color={colors.inkSecondary} />
                          <Text style={styles.collectorName}>{p.collectorName}</Text>
                        </View>

                        <View style={styles.metaRow}>
                          <View style={styles.methodPill}>
                            <Feather
                              name={p.method === 'upi' ? 'smartphone' : 'dollar-sign'}
                              size={11}
                              color={colors.primary}
                            />
                            <Text style={styles.methodText}>
                              {p.method === 'upi' ? 'UPI' : 'Cash'}
                            </Text>
                          </View>
                          <Text style={styles.dateText}>• {dateStr}</Text>
                        </View>
                      </View>

                      <View style={styles.amountCol}>
                        <Text style={[styles.amountText, { fontVariant: ['tabular-nums'] }]}>
                          {formatPaise(p.amountPaise)}
                        </Text>
                        <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
                          <Text style={[styles.statusText, { color: s.text }]}>{s.label}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Reversal audit reason if reversed */}
                    {p.status === 'reversed' && p.reversalReason && (
                      <View style={styles.reversalReasonBox}>
                        <Feather name="alert-triangle" size={13} color={colors.danger} />
                        <Text style={styles.reversalReasonText}>
                          Reversed: {p.reversalReason}
                        </Text>
                      </View>
                    )}

                    {/* Collector Reversal Action */}
                    {isCollectorOrAdmin && p.status === 'confirmed' && (
                      <View style={styles.actionRow}>
                        <Pressable
                          style={styles.reverseBtn}
                          onPress={() => handleOpenReversal(p)}
                        >
                          <Feather name="rotate-ccw" size={12} color={colors.danger} />
                          <Text style={styles.reverseBtnText}>Reverse Payment</Text>
                        </Pressable>
                      </View>
                    )}
                  </Card>
                );
              })
            )}
          </View>
        )}

        {/* Landlord Payouts List */}
        {(activeTab === 'all' || activeTab === 'landlord') && (
          <View style={styles.section}>
            {activeTab === 'all' && <Text style={styles.sectionHeader}>LANDLORD DISBURSEMENTS</Text>}
            {landlordPayments.length === 0 ? (
              <EmptyState
                icon="home"
                title="No Landlord Disbursements"
                description="Recorded landlord rent payments will appear here."
              />
            ) : (
              landlordPayments.map((lp) => {
                const dateStr = new Date(lp.paidAt).toLocaleDateString('en-IN', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });

                return (
                  <Card key={lp.id} style={styles.card}>
                    <View style={styles.cardRow}>
                      <View style={styles.landlordIconBox}>
                        <Feather name="home" size={20} color={colors.primary} />
                      </View>
                      <View style={styles.cardInfo}>
                        <Text style={styles.payerName}>Landlord Rent Payout</Text>
                        <Text style={styles.collectorName}>Paid by {lp.paidByName}</Text>
                        <View style={styles.metaRow}>
                          <View style={styles.methodPill}>
                            <Feather
                              name={lp.method === 'upi' ? 'smartphone' : 'dollar-sign'}
                              size={11}
                              color={colors.primary}
                            />
                            <Text style={styles.methodText}>
                              {lp.method === 'upi' ? 'Bank / UPI' : 'Cash'}
                            </Text>
                          </View>
                          <Text style={styles.dateText}>• {dateStr}</Text>
                        </View>
                      </View>

                      <View style={styles.amountCol}>
                        <Text style={[styles.amountText, { fontVariant: ['tabular-nums'] }]}>
                          {formatPaise(lp.amountPaise)}
                        </Text>
                        <View style={[styles.statusBadge, { backgroundColor: colors.successSoft }]}>
                          <Text style={[styles.statusText, { color: colors.success }]}>
                            Disbursed
                          </Text>
                        </View>
                      </View>
                    </View>
                  </Card>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* Reversal Modal */}
      <Modal visible={reversalModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Feather name="alert-triangle" size={22} color={colors.danger} />
              <Text style={styles.modalTitle}>Reverse Confirmed Payment</Text>
            </View>

            <Text style={styles.modalDesc}>
              Reversing {formatPaise(selectedPaymentForReversal?.amountPaise || 0)} from{' '}
              {selectedPaymentForReversal?.payerName} will reinstate their owed balance. Please provide
              an audit reason.
            </Text>

            <TextInput
              style={styles.reasonInput}
              placeholder="e.g. Bank chargeback / Wrong entry / Duplicate transfer"
              placeholderTextColor={colors.inkSecondary}
              value={reversalReason}
              onChangeText={setReversalReason}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalBtnRow}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setReversalModalVisible(false)}
                disabled={isSubmittingReversal}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[styles.modalConfirmBtn, isSubmittingReversal && styles.btnDisabled]}
                onPress={handleConfirmReversal}
                disabled={isSubmittingReversal}
              >
                <Text style={styles.modalConfirmText}>
                  {isSubmittingReversal ? 'Reversing...' : 'Confirm Reversal'}
                </Text>
              </Pressable>
            </View>
          </Card>
        </View>
      </Modal>
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
    paddingVertical: space.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  headerSubtitle: { fontSize: 12, color: colors.inkSecondary, marginTop: 2 },
  closeBtn: { padding: space.xs },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabItem: {
    paddingVertical: space.sm + 2,
    marginRight: space.lg,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.inkSecondary },
  tabTextActive: { color: colors.primary, fontWeight: '700' },

  container: { padding: space.lg, paddingBottom: 60 },
  section: { marginBottom: space.lg, gap: space.sm },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkSecondary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },

  card: { padding: space.md },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardInfo: { flex: 1, marginLeft: space.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  payerName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  collectorName: { fontSize: 12, color: colors.inkSecondary },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
  methodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    gap: 4,
  },
  methodText: { fontSize: 10, fontWeight: '600', color: colors.primary },
  dateText: { fontSize: 11, color: colors.inkSecondary },

  amountCol: { alignItems: 'flex-end' },
  amountText: { fontSize: 15, fontWeight: '800', color: colors.ink },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, marginTop: 4 },
  statusText: { fontSize: 10, fontWeight: '700' },

  landlordIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  reversalReasonBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    marginTop: space.sm,
    gap: 6,
  },
  reversalReasonText: { fontSize: 11, color: colors.danger, fontWeight: '600', flex: 1 },

  actionRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: space.xs + 2,
    marginTop: space.sm,
    alignItems: 'flex-end',
  },
  reverseBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  reverseBtnText: { fontSize: 11, fontWeight: '600', color: colors.danger },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: space.lg,
  },
  modalCard: { padding: space.lg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.sm },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  modalDesc: { fontSize: 12, color: colors.inkSecondary, lineHeight: 18, marginBottom: space.md },
  reasonInput: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
    fontSize: 13,
    color: colors.ink,
    textAlignVertical: 'top',
    minHeight: 80,
    marginBottom: space.lg,
  },
  modalBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.md },
  modalCancelBtn: { paddingVertical: space.sm, paddingHorizontal: space.md },
  modalCancelText: { fontSize: 13, fontWeight: '600', color: colors.inkSecondary },
  modalConfirmBtn: {
    backgroundColor: colors.danger,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
  },
  modalConfirmText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  btnDisabled: { opacity: 0.6 },
});
