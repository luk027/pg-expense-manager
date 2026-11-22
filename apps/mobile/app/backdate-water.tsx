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
import { useWaterService } from '../context/WaterServiceContext';
import { formatPaise } from '../lib/utils';

export default function BackdateWaterScreen() {
  const router = useRouter();
  const { serviceConfig, recordBackdatedDelivery } = useWaterService();

  // Date helpers
  const todayIST = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().substring(0, 10);
  const yesterdayIST = new Date(Date.now() + 5.5 * 3600 * 1000 - 86400000).toISOString().substring(0, 10);
  const twoDaysAgoIST = new Date(Date.now() + 5.5 * 3600 * 1000 - 2 * 86400000).toISOString().substring(0, 10);

  const [deliveryDate, setDeliveryDate] = useState(todayIST);
  const [deliveryTime, setDeliveryTime] = useState('09:00');
  const [quantity, setQuantity] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (RNStatusBar.currentHeight || 28) : 0,
    24
  );

  const totalPaise = serviceConfig.waterPricePaise * quantity;

  const handleSubmit = async () => {
    // Validate date format YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) {
      Alert.alert('Invalid Date', 'Please enter date in YYYY-MM-DD format.');
      return;
    }

    // Validate future date
    if (deliveryDate > todayIST) {
      Alert.alert('Invalid Date', 'Future water deliveries are not allowed.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await recordBackdatedDelivery({
        deliveryDate,
        deliveryTime,
        count: quantity,
      });

      if (res.success) {
        Alert.alert(
          'Water Logged',
          `Successfully recorded ${quantity} ${quantity > 1 ? 'deliveries' : 'delivery'} on ${deliveryDate} (${formatPaise(totalPaise)}).`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert('Error', res.error || 'Failed to record delivery');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Backdate Water Delivery</Text>
          <Text style={styles.headerSubtitle}>Log past or multiple deliveries</Text>
        </View>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Feather name="x" size={22} color={colors.inkSecondary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Date Selection Card */}
        <Card style={styles.card}>
          <Text style={styles.cardLabel}>DELIVERY DATE (YYYY-MM-DD)</Text>
          <Input
            value={deliveryDate}
            onChangeText={setDeliveryDate}
            placeholder="YYYY-MM-DD"
          />

          {/* Quick Date Chips */}
          <View style={styles.chipRow}>
            <Pressable
              style={[styles.chip, deliveryDate === todayIST && styles.chipActive]}
              onPress={() => setDeliveryDate(todayIST)}
            >
              <Text style={[styles.chipText, deliveryDate === todayIST && styles.chipTextActive]}>
                Today
              </Text>
            </Pressable>

            <Pressable
              style={[styles.chip, deliveryDate === yesterdayIST && styles.chipActive]}
              onPress={() => setDeliveryDate(yesterdayIST)}
            >
              <Text style={[styles.chipText, deliveryDate === yesterdayIST && styles.chipTextActive]}>
                Yesterday
              </Text>
            </Pressable>

            <Pressable
              style={[styles.chip, deliveryDate === twoDaysAgoIST && styles.chipActive]}
              onPress={() => setDeliveryDate(twoDaysAgoIST)}
            >
              <Text style={[styles.chipText, deliveryDate === twoDaysAgoIST && styles.chipTextActive]}>
                2 Days Ago
              </Text>
            </Pressable>
          </View>
        </Card>

        {/* Time of Day Card */}
        <Card style={styles.card}>
          <Text style={styles.cardLabel}>DELIVERY TIME</Text>
          <View style={styles.timeGrid}>
            {[
              { label: 'Morning (09:00)', value: '09:00' },
              { label: 'Noon (12:30)', value: '12:30' },
              { label: 'Evening (18:30)', value: '18:30' },
            ].map((t) => (
              <Pressable
                key={t.value}
                style={[styles.timeBtn, deliveryTime === t.value && styles.timeBtnActive]}
                onPress={() => setDeliveryTime(t.value)}
              >
                <Feather
                  name="clock"
                  size={14}
                  color={deliveryTime === t.value ? colors.primary : colors.inkSecondary}
                />
                <Text
                  style={[
                    styles.timeBtnText,
                    deliveryTime === t.value && styles.timeBtnTextActive,
                  ]}
                >
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {/* Quantity / Jugs Card */}
        <Card style={styles.card}>
          <Text style={styles.cardLabel}>DELIVERIES RECEIVED ON THIS DAY</Text>
          <View style={styles.qtyRow}>
            {[1, 2, 3].map((q) => (
              <Pressable
                key={q}
                style={[styles.qtyCard, quantity === q && styles.qtyCardActive]}
                onPress={() => setQuantity(q)}
              >
                <Text style={[styles.qtyNumber, quantity === q && styles.qtyNumberActive]}>
                  {q}
                </Text>
                <Text style={styles.qtyLabel}>{q > 1 ? 'Deliveries' : 'Delivery'}</Text>
                <Text style={styles.qtyPrice}>
                  {formatPaise(serviceConfig.waterPricePaise * q)}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {/* Summary Preview */}
        <View style={styles.summaryBox}>
          <View>
            <Text style={styles.summaryLabel}>Total Amount to Log:</Text>
            <Text style={styles.summaryDesc}>
              {quantity} {quantity > 1 ? 'deliveries' : 'delivery'} on {deliveryDate}
            </Text>
          </View>
          <Text style={[styles.summaryAmount, { fontVariant: ['tabular-nums'] }]}>
            {formatPaise(totalPaise)}
          </Text>
        </View>

        {/* Action Button */}
        <View style={styles.actions}>
          <Button
            title={isSubmitting ? 'Logging...' : `Record ${formatPaise(totalPaise)} Delivery`}
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
    paddingBottom: space.sm + 4,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  headerSubtitle: { fontSize: 12, color: colors.inkSecondary, marginTop: 2 },
  closeBtn: { padding: space.xs },
  container: { padding: space.lg, paddingBottom: 60 },

  card: { padding: space.md, marginBottom: space.md },
  cardLabel: { fontSize: 10, fontWeight: '700', color: colors.inkSecondary, letterSpacing: 0.5, marginBottom: space.xs },

  chipRow: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.inkSecondary },
  chipTextActive: { color: colors.primary, fontWeight: '700' },

  timeGrid: { gap: space.xs + 2 },
  timeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    gap: space.sm,
  },
  timeBtnActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  timeBtnText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  timeBtnTextActive: { color: colors.primary, fontWeight: '700' },

  qtyRow: { flexDirection: 'row', gap: space.sm },
  qtyCard: {
    flex: 1,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  qtyCardActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  qtyNumber: { fontSize: 22, fontWeight: '800', color: colors.ink },
  qtyNumberActive: { color: colors.primary },
  qtyLabel: { fontSize: 11, color: colors.inkSecondary, marginTop: 2 },
  qtyPrice: { fontSize: 12, fontWeight: '700', color: colors.ink, marginTop: 4 },

  summaryBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: space.lg,
  },
  summaryLabel: { fontSize: 13, fontWeight: '700', color: colors.ink },
  summaryDesc: { fontSize: 11, color: colors.inkSecondary, marginTop: 2 },
  summaryAmount: { fontSize: 20, fontWeight: '800', color: colors.primary },

  actions: { gap: space.md },
  cancelBtn: { alignItems: 'center', paddingVertical: space.sm },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: colors.inkSecondary },
});
