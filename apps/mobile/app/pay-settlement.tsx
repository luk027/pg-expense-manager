import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Pressable,
  Alert,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Card, Button, Avatar } from '../components/ui';
import { colors, space, radius } from '../lib/tokens';
import { usePayments } from '../context/PaymentContext';
import { useSettlement } from '../context/SettlementContext';
import { useRoom } from '../context/RoomContext';
import { useAuth } from '../context/AuthContext';
import { formatPaise } from '../lib/utils';

export default function PaySettlementScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ settlementId?: string; amountPaise?: string }>();
  const { user } = useAuth();
  const { room, activeMembers } = useRoom();
  const { settlement, statement, selectedPeriod } = useSettlement();
  const { sendPayment } = usePayments();

  const [method, setMethod] = useState<'upi' | 'cash'>('upi');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isCollectorSelf = user?.id === room?.collectorId;

  // Derive collector
  const collector = activeMembers.find((m) => m.userId === room?.collectorId) || {
    name: 'Rahul Sharma',
    phone: '+91 98765 43210',
    email: 'rahul@pgexpense.com',
  };

  // Derive amount owed
  const myStatement = statement?.memberStatements.find((m) => m.userId === user?.id);
  const amountPaise = params.amountPaise
    ? parseInt(params.amountPaise, 10)
    : myStatement?.netAmountOwedPaise || 700000;

  const targetSettlementId = params.settlementId || settlement?.id || `set-${selectedPeriod}-flat302`;

  const handlePay = async () => {
    setIsSubmitting(true);
    try {
      const res = await sendPayment({
        settlementId: targetSettlementId,
        amountPaise,
        method,
      });

      if (res.success) {
        Alert.alert(
          isCollectorSelf ? 'Payment Auto-Confirmed' : 'Payment Marked as Sent',
          isCollectorSelf
            ? `Your share payment of ${formatPaise(amountPaise)} has been recorded and automatically cleared.`
            : method === 'upi'
            ? `Your UPI payment of ${formatPaise(amountPaise)} has been submitted. ${collector.name} will confirm receipt.`
            : `Cash payment of ${formatPaise(amountPaise)} logged. Please hand over physical cash to ${collector.name} for confirmation.`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert('Payment Submission Error', res.error || 'Failed to submit payment');
      }
    } catch {
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
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
          <Text style={styles.headerTitle}>Pay Monthly Settlement</Text>
          <Text style={styles.headerSubtitle}>Billing Cycle: {selectedPeriod}</Text>
        </View>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Feather name="x" size={22} color={colors.inkSecondary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Collector Destination Card */}
        <Card style={styles.collectorCard}>
          <Text style={styles.cardEyebrow}>
            {isCollectorSelf ? 'RECORDING COLLECTOR SHARE' : 'PAYING RENT COLLECTOR'}
          </Text>
          <View style={styles.collectorRow}>
            <Avatar name={isCollectorSelf ? user?.name || 'Rahul Sharma' : collector.name} size="md" />
            <View style={styles.collectorDetails}>
              <Text style={styles.collectorName}>
                {isCollectorSelf ? `${user?.name || 'Rahul Sharma'} (You)` : collector.name}
              </Text>
              <Text style={styles.collectorRole}>
                {isCollectorSelf ? 'Designated Collector • Auto-Confirmed' : 'Designated Flat Rent Collector'}
              </Text>
              {!isCollectorSelf && (
                <Text style={styles.collectorUpi}>UPI ID: rahul.sharma@okaxis</Text>
              )}
            </View>
          </View>
        </Card>

        {/* Amount Box */}
        <Card style={styles.amountCard}>
          <Text style={styles.amountLabel}>NET SETTLEMENT AMOUNT DUE</Text>
          <Text style={styles.amountDisplay}>{formatPaise(amountPaise)}</Text>
          <View style={styles.ruleBadge}>
            <Feather name="info" size={13} color={colors.primary} />
            <Text style={styles.ruleBadgeText}>Full payment rule active (No partial payments)</Text>
          </View>
        </Card>

        {/* Payment Method Selector */}
        <Text style={styles.sectionTitle}>SELECT PAYMENT METHOD</Text>
        <View style={styles.methodContainer}>
          <Pressable
            style={[styles.methodCard, method === 'upi' && styles.methodCardActive]}
            onPress={() => setMethod('upi')}
          >
            <View style={styles.methodIconRow}>
              <Feather
                name="smartphone"
                size={22}
                color={method === 'upi' ? colors.primary : colors.inkSecondary}
              />
              {method === 'upi' && <Feather name="check-circle" size={18} color={colors.primary} />}
            </View>
            <Text style={[styles.methodTitle, method === 'upi' && styles.methodTitleActive]}>
              UPI Transfer
            </Text>
            <Text style={styles.methodDesc}>GPay, PhonePe, Paytm, or BHIM</Text>
          </Pressable>

          <Pressable
            style={[styles.methodCard, method === 'cash' && styles.methodCardActive]}
            onPress={() => setMethod('cash')}
          >
            <View style={styles.methodIconRow}>
              <Feather
                name="dollar-sign"
                size={22}
                color={method === 'cash' ? colors.primary : colors.inkSecondary}
              />
              {method === 'cash' && <Feather name="check-circle" size={18} color={colors.primary} />}
            </View>
            <Text style={[styles.methodTitle, method === 'cash' && styles.methodTitleActive]}>
              Cash in Hand
            </Text>
            <Text style={styles.methodDesc}>Hand physical currency to collector</Text>
          </Pressable>
        </View>

        {/* Verification Notice */}
        <View style={styles.noticeBox}>
          <Feather name="shield" size={16} color={colors.inkSecondary} />
          <Text style={styles.noticeText}>
            {isCollectorSelf
              ? 'As Rent Collector, your own net settlement payment is automatically marked as confirmed upon recording.'
              : `After you tap "Mark as Sent", your payment is recorded as Pending until confirmed by ${collector.name}. Both you and the collector receive an audit receipt.`}
          </Text>
        </View>

        {/* Primary CTA */}
        <View style={styles.actions}>
          <Button
            title={
              isSubmitting
                ? 'Recording Payment...'
                : isCollectorSelf
                ? `Record ${formatPaise(amountPaise)} Auto-Confirmed`
                : `Mark ${formatPaise(amountPaise)} as Sent`
            }
            variant="primary"
            size="lg"
            onPress={handlePay}
            disabled={isSubmitting}
          />
          <Pressable style={styles.cancelBtn} onPress={() => router.back()}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
        </View>
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

  collectorCard: { padding: space.md, marginBottom: space.md },
  cardEyebrow: { fontSize: 10, fontWeight: '700', color: colors.inkSecondary, letterSpacing: 0.5, marginBottom: space.sm },
  collectorRow: { flexDirection: 'row', alignItems: 'center' },
  collectorDetails: { marginLeft: space.md, flex: 1 },
  collectorName: { fontSize: 16, fontWeight: '700', color: colors.ink },
  collectorRole: { fontSize: 12, color: colors.inkSecondary, marginTop: 2 },
  collectorUpi: { fontSize: 12, fontWeight: '600', color: colors.primary, marginTop: 4 },

  amountCard: { padding: space.lg, alignItems: 'center', marginBottom: space.lg },
  amountLabel: { fontSize: 11, fontWeight: '700', color: colors.inkSecondary, letterSpacing: 0.5 },
  amountDisplay: { fontSize: 36, fontWeight: '800', color: colors.ink, marginVertical: space.sm, fontVariant: ['tabular-nums'] },
  ruleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: space.sm + 4,
    paddingVertical: 5,
    borderRadius: radius.pill,
    gap: 6,
  },
  ruleBadgeText: { fontSize: 11, fontWeight: '600', color: colors.primary },

  sectionTitle: { fontSize: 11, fontWeight: '700', color: colors.inkSecondary, letterSpacing: 0.5, marginBottom: space.xs },
  methodContainer: { flexDirection: 'row', gap: space.sm, marginBottom: space.lg },
  methodCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  methodCardActive: { borderColor: colors.primary, backgroundColor: colors.surfaceMuted },
  methodIconRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.xs },
  methodTitle: { fontSize: 14, fontWeight: '700', color: colors.ink, marginTop: 4 },
  methodTitleActive: { color: colors.primary },
  methodDesc: { fontSize: 11, color: colors.inkSecondary, marginTop: 2, lineHeight: 14 },

  noticeBox: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    padding: space.md,
    borderRadius: radius.md,
    gap: space.sm,
    marginBottom: space.xl,
  },
  noticeText: { flex: 1, fontSize: 12, color: colors.inkSecondary, lineHeight: 18 },

  actions: { gap: space.md },
  cancelBtn: { alignItems: 'center', paddingVertical: space.sm },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: colors.inkSecondary },
});
