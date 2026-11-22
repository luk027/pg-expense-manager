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
  RefreshControl,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Card, Button, Avatar, EmptyState } from '../components/ui';
import { colors, space, radius } from '../lib/tokens';
import { usePayments, PaymentItem } from '../context/PaymentContext';
import { useSettlement } from '../context/SettlementContext';
import { formatPaise } from '../lib/utils';

export default function CollectorConfirmationsScreen() {
  const router = useRouter();
  const { pendingConfirmations, confirmPayment, cancelPayment, refreshPayments, isLoading } =
    usePayments();
  const { refreshSettlement } = useSettlement();

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshPayments();
    await refreshSettlement();
    setRefreshing(false);
  };

  const handleConfirm = async (item: PaymentItem) => {
    setProcessingId(item.id);
    try {
      const res = await confirmPayment(item.id);
      if (res.success) {
        Alert.alert(
          'Payment Confirmed',
          `Successfully confirmed receipt of ${formatPaise(item.amountPaise)} from ${item.payerName}.`
        );
      } else {
        Alert.alert('Error', res.error || 'Failed to confirm payment');
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = (item: PaymentItem) => {
    Alert.alert(
      'Reject Payment?',
      `Are you sure you have not received ${formatPaise(item.amountPaise)} from ${item.payerName}? This will reset their payment status to Pending.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(item.id);
            try {
              const res = await cancelPayment(item.id);
              if (res.success) {
                Alert.alert('Payment Rejected', 'The payment request has been dismissed.');
              } else {
                Alert.alert('Error', res.error || 'Failed to reject payment');
              }
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
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
          <Text style={styles.headerTitle}>Payment Confirmations</Text>
          <Text style={styles.headerSubtitle}>
            {pendingConfirmations.length === 0
              ? 'No pending confirmations'
              : `${pendingConfirmations.length} pending verification`}
          </Text>
        </View>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Feather name="x" size={22} color={colors.inkSecondary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Info card */}
        <View style={styles.infoBanner}>
          <Feather name="shield" size={18} color={colors.primary} />
          <Text style={styles.infoText}>
            As rent collector, verify your bank/UPI app or cash in hand before confirming receipt.
            Confirmed payments immediately clear roommate dues.
          </Text>
        </View>

        {pendingConfirmations.length === 0 ? (
          <EmptyState
            icon="check-circle"
            title="All Caught Up!"
            description="No roommates have pending payments waiting for your confirmation."
            actionTitle="Back to Settlement"
            onActionPress={() => router.back()}
          />
        ) : (
          <View style={styles.list}>
            {pendingConfirmations.map((item) => {
              const isProcessing = processingId === item.id;
              const dateStr = new Date(item.sentAt).toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <Card key={item.id} style={styles.itemCard}>
                  {/* Top Row: User & Amount */}
                  <View style={styles.itemTopRow}>
                    <Avatar name={item.payerName} size="md" />
                    <View style={styles.itemInfo}>
                      <Text style={styles.payerName}>{item.payerName}</Text>
                      <View style={styles.methodBadgeRow}>
                        <View style={styles.methodPill}>
                          <Feather
                            name={item.method === 'upi' ? 'smartphone' : 'dollar-sign'}
                            size={12}
                            color={colors.primary}
                          />
                          <Text style={styles.methodText}>
                            {item.method === 'upi' ? 'UPI Transfer' : 'Cash in Hand'}
                          </Text>
                        </View>
                        <Text style={styles.timestampText}>• {dateStr}</Text>
                      </View>
                    </View>
                    <View style={styles.amountCol}>
                      <Text style={[styles.amountText, { fontVariant: ['tabular-nums'] }]}>
                        {formatPaise(item.amountPaise)}
                      </Text>
                      <Text style={styles.pendingTag}>Pending</Text>
                    </View>
                  </View>

                  {/* Actions */}
                  <View style={styles.actionRow}>
                    <Pressable
                      style={styles.rejectBtn}
                      onPress={() => handleReject(item)}
                      disabled={isProcessing}
                    >
                      <Feather name="x" size={14} color={colors.danger} />
                      <Text style={styles.rejectBtnText}>Not Received</Text>
                    </Pressable>

                    <Pressable
                      style={[styles.confirmBtn, isProcessing && styles.btnDisabled]}
                      onPress={() => handleConfirm(item)}
                      disabled={isProcessing}
                    >
                      <Feather name="check" size={15} color="#FFFFFF" />
                      <Text style={styles.confirmBtnText}>
                        {isProcessing ? 'Confirming...' : 'Confirm Received'}
                      </Text>
                    </Pressable>
                  </View>
                </Card>
              );
            })}
          </View>
        )}
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
    paddingVertical: space.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  headerSubtitle: { fontSize: 12, color: colors.inkSecondary, marginTop: 2 },
  closeBtn: { padding: space.xs },
  container: { padding: space.lg, paddingBottom: 60 },

  infoBanner: {
    flexDirection: 'row',
    backgroundColor: colors.primarySoft,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: space.lg,
    gap: space.sm,
    alignItems: 'center',
  },
  infoText: { flex: 1, fontSize: 12, color: colors.inkSecondary, lineHeight: 18 },

  list: { gap: space.md },
  itemCard: { padding: space.md },
  itemTopRow: { flexDirection: 'row', alignItems: 'center' },
  itemInfo: { flex: 1, marginLeft: space.md },
  payerName: { fontSize: 15, fontWeight: '700', color: colors.ink },
  methodBadgeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
  methodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    gap: 4,
  },
  methodText: { fontSize: 11, fontWeight: '600', color: colors.primary },
  timestampText: { fontSize: 11, color: colors.inkSecondary },

  amountCol: { alignItems: 'flex-end' },
  amountText: { fontSize: 16, fontWeight: '800', color: colors.ink },
  pendingTag: { fontSize: 11, fontWeight: '700', color: colors.warning, marginTop: 2 },

  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: space.sm + 2,
    marginTop: space.md,
    gap: space.sm,
  },
  rejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    gap: 4,
  },
  rejectBtnText: { fontSize: 12, fontWeight: '600', color: colors.danger },

  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.xs + 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    gap: 6,
  },
  confirmBtnText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  btnDisabled: { opacity: 0.6 },
});
