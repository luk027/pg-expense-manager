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
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Card, Button, Input } from '../components/ui';
import { colors, space, radius } from '../lib/tokens';
import { usePayments } from '../context/PaymentContext';
import { useSettlement } from '../context/SettlementContext';
import { useRoom } from '../context/RoomContext';
import { formatPaise } from '../lib/utils';

export default function PayLandlordScreen() {
  const router = useRouter();
  const { room } = useRoom();
  const { settlement, selectedPeriod } = useSettlement();
  const { recordLandlordPayment } = usePayments();

  const defaultRentPaise = room?.monthlyRentPaise || 2800000;
  const [amountRupees, setAmountRupees] = useState((defaultRentPaise / 100).toString());
  const [method, setMethod] = useState<'upi' | 'cash'>('upi');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parsedRupees = parseFloat(amountRupees) || 0;
  const amountPaise = Math.round(parsedRupees * 100);
  const targetSettlementId = settlement?.id || `set-${selectedPeriod}-flat302`;

  const handleSubmit = async () => {
    if (amountPaise <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid rent amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await recordLandlordPayment({
        settlementId: targetSettlementId,
        amountPaise,
        method,
      });

      if (res.success) {
        Alert.alert(
          'Landlord Rent Recorded',
          `Successfully recorded ${formatPaise(amountPaise)} rent payout to the property owner for ${selectedPeriod}.`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert('Error', res.error || 'Failed to record landlord payment');
      }
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
          <Text style={styles.headerTitle}>Record Landlord Rent</Text>
          <Text style={styles.headerSubtitle}>Disbursement • {selectedPeriod}</Text>
        </View>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Feather name="x" size={22} color={colors.inkSecondary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Info card */}
        <View style={styles.infoBanner}>
          <Feather name="home" size={18} color={colors.primary} />
          <Text style={styles.infoText}>
            Record full property rent disbursed to the owner. This creates an unalterable audit log
            visible to all roommates.
          </Text>
        </View>

        {/* Property & Owner Details */}
        <Card style={styles.detailsCard}>
          <Text style={styles.cardEyebrow}>PROPERTY DISBURSEMENT</Text>
          <Text style={styles.propertyName}>{room?.name || 'Flat 302, Green Glen'}</Text>
          <Text style={styles.ownerText}>Beneficiary: Property Owner / Landlord</Text>
          <View style={styles.rentRow}>
            <Text style={styles.rentLabel}>Contract Monthly Rent:</Text>
            <Text style={styles.rentValue}>{formatPaise(defaultRentPaise)}</Text>
          </View>
        </Card>

        {/* Amount Input */}
        <Card style={styles.inputCard}>
          <Text style={styles.inputLabel}>AMOUNT PAID TO OWNER (₹)</Text>
          <Input
            value={amountRupees}
            onChangeText={setAmountRupees}
            keyboardType="numeric"
            placeholder="28000"
          />
          <Text style={styles.hintText}>
            Parsed: {formatPaise(amountPaise)}
          </Text>
        </Card>

        {/* Payment Method Selector */}
        <Text style={styles.sectionTitle}>DISBURSEMENT METHOD</Text>
        <View style={styles.methodContainer}>
          <Pressable
            style={[styles.methodCard, method === 'upi' && styles.methodCardActive]}
            onPress={() => setMethod('upi')}
          >
            <View style={styles.methodIconRow}>
              <Feather
                name="smartphone"
                size={20}
                color={method === 'upi' ? colors.primary : colors.inkSecondary}
              />
              {method === 'upi' && <Feather name="check-circle" size={16} color={colors.primary} />}
            </View>
            <Text style={[styles.methodTitle, method === 'upi' && styles.methodTitleActive]}>
              Bank / UPI
            </Text>
            <Text style={styles.methodDesc}>NEFT, IMPS, RTGS, or UPI</Text>
          </Pressable>

          <Pressable
            style={[styles.methodCard, method === 'cash' && styles.methodCardActive]}
            onPress={() => setMethod('cash')}
          >
            <View style={styles.methodIconRow}>
              <Feather
                name="dollar-sign"
                size={20}
                color={method === 'cash' ? colors.primary : colors.inkSecondary}
              />
              {method === 'cash' && <Feather name="check-circle" size={16} color={colors.primary} />}
            </View>
            <Text style={[styles.methodTitle, method === 'cash' && styles.methodTitleActive]}>
              Physical Cash
            </Text>
            <Text style={styles.methodDesc}>Cash receipt with landlord</Text>
          </Pressable>
        </View>

        {/* Notes / Reference */}
        <Card style={styles.inputCard}>
          <Text style={styles.inputLabel}>TRANSACTION REFERENCE / NOTE (OPTIONAL)</Text>
          <Input
            value={note}
            onChangeText={setNote}
            placeholder="e.g. UTR / Bank Ref / Receipt #104"
          />
        </Card>

        {/* Submit Actions */}
        <View style={styles.actions}>
          <Button
            title={isSubmitting ? 'Recording...' : `Record ${formatPaise(amountPaise)} Payout`}
            variant="primary"
            size="lg"
            onPress={handleSubmit}
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

  detailsCard: { padding: space.md, marginBottom: space.md },
  cardEyebrow: { fontSize: 10, fontWeight: '700', color: colors.inkSecondary, letterSpacing: 0.5 },
  propertyName: { fontSize: 16, fontWeight: '700', color: colors.ink, marginTop: 4 },
  ownerText: { fontSize: 12, color: colors.inkSecondary, marginTop: 2 },
  rentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: space.sm,
    marginTop: space.sm,
  },
  rentLabel: { fontSize: 12, color: colors.inkSecondary },
  rentValue: { fontSize: 14, fontWeight: '700', color: colors.ink },

  inputCard: { padding: space.md, marginBottom: space.md },
  inputLabel: { fontSize: 11, fontWeight: '700', color: colors.inkSecondary, letterSpacing: 0.5, marginBottom: space.xs },
  hintText: { fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: 6 },

  sectionTitle: { fontSize: 11, fontWeight: '700', color: colors.inkSecondary, letterSpacing: 0.5, marginBottom: space.xs },
  methodContainer: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  methodCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  methodCardActive: { borderColor: colors.primary, backgroundColor: colors.surfaceMuted },
  methodIconRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  methodTitle: { fontSize: 13, fontWeight: '700', color: colors.ink, marginTop: 4 },
  methodTitleActive: { color: colors.primary },
  methodDesc: { fontSize: 10, color: colors.inkSecondary, marginTop: 2 },

  actions: { marginTop: space.md, gap: space.md },
  cancelBtn: { alignItems: 'center', paddingVertical: space.sm },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: colors.inkSecondary },
});
