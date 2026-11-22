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
import { useSettlement } from '../context/SettlementContext';
import { useRoom } from '../context/RoomContext';
import { formatPaise } from '../lib/utils';

export default function FinalizeModalScreen() {
  const router = useRouter();
  const { period } = useLocalSearchParams<{ period?: string }>();
  const { statement, finalizeSettlement, selectedPeriod } = useSettlement();
  const { room } = useRoom();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const activePeriod = period || selectedPeriod;

  const handleFinalize = async () => {
    setIsSubmitting(true);
    try {
      const res = await finalizeSettlement();
      if (res.success) {
        Alert.alert(
          'Settlement Finalized',
          `The settlement for ${activePeriod} has been locked. All roommates can now view and settle their exact balance.`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert('Error', res.error || 'Failed to finalize settlement');
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
          <Text style={styles.headerTitle}>Finalize Settlement</Text>
          <Text style={styles.headerSubtitle}>Period: {activePeriod}</Text>
        </View>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Feather name="x" size={22} color={colors.inkSecondary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Warning / Explanation Banner */}
        <View style={styles.infoBanner}>
          <Feather name="lock" size={20} color={colors.primary} />
          <View style={styles.infoTextCol}>
            <Text style={styles.infoTitle}>Locking Financial Calculations</Text>
            <Text style={styles.infoDesc}>
              Finalizing freezes rent and expense splits. Any future edits or late bills will carry forward to the next billing cycle as adjustments.
            </Text>
          </View>
        </View>

        {/* Summary Card */}
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>TOTAL ROOM OBLIGATION</Text>
          <Text style={styles.grandTotalText}>
            {formatPaise(statement?.grandTotalPaise || 2800000)}
          </Text>

          <View style={styles.breakdownRow}>
            <View style={styles.breakdownCol}>
              <Text style={styles.breakdownLabel}>Rent</Text>
              <Text style={styles.breakdownValue}>
                {formatPaise(statement?.totalRentPaise || 2800000)}
              </Text>
            </View>
            <View style={styles.breakdownCol}>
              <Text style={styles.breakdownLabel}>Expenses</Text>
              <Text style={styles.breakdownValue}>
                {formatPaise(statement?.totalExpensesPaise || 0)}
              </Text>
            </View>
            <View style={styles.breakdownCol}>
              <Text style={styles.breakdownLabel}>Roommates</Text>
              <Text style={styles.breakdownValue}>{statement?.memberCount || 4}</Text>
            </View>
          </View>
        </Card>

        {/* Roommate Net Balances Preview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Roommate Payment Preview</Text>
          <Card style={styles.rosterCard}>
            {(statement?.memberStatements || []).map((m, idx) => (
              <View key={m.userId || idx} style={[styles.rosterRow, idx > 0 && styles.rosterBorder]}>
                <Avatar name={m.name} size="sm" />
                <View style={styles.rosterInfo}>
                  <Text style={styles.rosterName}>{m.name}</Text>
                  <Text style={styles.rosterSub}>
                    {m.expensePaidPaise > 0
                      ? `Upfront credit: ${formatPaise(m.expensePaidPaise)}`
                      : 'No upfront credit'}
                  </Text>
                </View>
                <Text style={[styles.rosterAmount, { fontVariant: ['tabular-nums'] }]}>
                  {formatPaise(m.netAmountOwedPaise)}
                </Text>
              </View>
            ))}
          </Card>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          <Button
            title={isSubmitting ? 'Locking Settlement...' : 'Yes, Lock & Finalize Settlement'}
            variant="primary"
            size="lg"
            onPress={handleFinalize}
            disabled={isSubmitting}
          />
          <Pressable style={styles.cancelBtn} onPress={() => router.back()}>
            <Text style={styles.cancelBtnText}>Cancel & Keep Draft</Text>
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
  },
  infoTextCol: { flex: 1 },
  infoTitle: { fontSize: 14, fontWeight: '700', color: colors.primary },
  infoDesc: { fontSize: 12, color: colors.inkSecondary, marginTop: 4, lineHeight: 18 },

  summaryCard: { padding: space.md + 2, alignItems: 'center', marginBottom: space.lg },
  summaryLabel: { fontSize: 11, fontWeight: '700', color: colors.inkSecondary, letterSpacing: 0.5 },
  grandTotalText: { fontSize: 32, fontWeight: '800', color: colors.ink, marginVertical: space.xs },

  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: space.md,
    marginTop: space.sm,
  },
  breakdownCol: { alignItems: 'center' },
  breakdownLabel: { fontSize: 11, color: colors.inkSecondary },
  breakdownValue: { fontSize: 14, fontWeight: '700', color: colors.ink, marginTop: 2 },

  section: { marginBottom: space.lg },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.inkSecondary, textTransform: 'uppercase', marginBottom: space.xs },
  rosterCard: { padding: 0, overflow: 'hidden' },
  rosterRow: { flexDirection: 'row', alignItems: 'center', padding: space.md },
  rosterBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  rosterInfo: { flex: 1, marginLeft: space.md },
  rosterName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  rosterSub: { fontSize: 11, color: colors.inkSecondary, marginTop: 2 },
  rosterAmount: { fontSize: 15, fontWeight: '800', color: colors.primary },

  actionSection: { marginTop: space.sm, gap: space.md },
  cancelBtn: { alignItems: 'center', paddingVertical: space.sm },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: colors.inkSecondary },
});
