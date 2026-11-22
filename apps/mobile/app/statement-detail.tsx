import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Pressable,
  Share,
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

export default function StatementDetailScreen() {
  const router = useRouter();
  const { period } = useLocalSearchParams<{ period?: string }>();
  const { statement, isFinalized, selectedPeriod } = useSettlement();
  const { room } = useRoom();

  const activePeriod = period || selectedPeriod;

  const handleShare = async () => {
    if (!statement) return;
    const summaryLines = [
      `📊 Flat Settlement Statement: ${room?.name || 'Flat 302'} (${activePeriod})`,
      `• Total Rent: ${formatPaise(statement.totalRentPaise)}`,
      `• Total Expenses: ${formatPaise(statement.totalExpensesPaise)}`,
      `• Grand Total: ${formatPaise(statement.grandTotalPaise)}`,
      ``,
      `Roommate Balances:`,
      ...statement.memberStatements.map(
        (m) => `• ${m.name}: Owed ${formatPaise(m.netAmountOwedPaise)} (Paid upfront: ${formatPaise(m.expensePaidPaise)})`
      ),
    ].join('\n');

    try {
      await Share.share({ message: summaryLines, title: `Statement ${activePeriod}` });
    } catch {
      // Ignore share sheet cancel
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
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Full Settlement Statement</Text>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Feather name="x" size={20} color={colors.inkSecondary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Statement Hero Summary */}
        <View style={styles.heroCard}>
          <Text style={styles.heroPeriod}>STATEMENT PERIOD: {activePeriod}</Text>
          <Text style={styles.heroFlatName}>{room?.name || 'Flat 302, Green Glen'}</Text>
          <Text style={styles.heroTotal}>{formatPaise(statement?.grandTotalPaise || 2800000)}</Text>
          <Text style={styles.heroSub}>
            Status: {isFinalized ? 'Finalized & Locked' : 'Draft Settlement'}
          </Text>
        </View>

        {/* Itemized Line Items */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Itemized Line Items ({statement?.lineItems.length || 0})</Text>

          <Card style={styles.linesCard}>
            {(statement?.lineItems || []).map((line, idx) => (
              <View key={line.id || idx} style={[styles.lineItemRow, idx > 0 && styles.lineItemBorder]}>
                <View style={styles.lineMain}>
                  <View style={styles.lineTitleRow}>
                    <Text style={styles.lineTitle}>{line.name}</Text>
                    <View
                      style={[
                        styles.typeBadge,
                        line.type === 'rent' ? styles.typeRent : styles.typeExpense,
                      ]}
                    >
                      <Text
                        style={[
                          line.type === 'rent' ? styles.typeRentText : styles.typeExpenseText,
                        ]}
                      >
                        {line.type.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {line.paidByName && (
                    <Text style={styles.linePayer}>Paid by {line.paidByName}</Text>
                  )}
                  {line.billingPeriod && (
                    <Text style={styles.lineBilling}>Billing period: {line.billingPeriod}</Text>
                  )}
                </View>

                <View style={styles.lineAmountCol}>
                  <Text style={[styles.lineAmount, { fontVariant: ['tabular-nums'] }]}>
                    {formatPaise(line.totalAmountPaise)}
                  </Text>
                  <Text style={styles.lineSharePerHead}>
                    {formatPaise(Math.round(line.totalAmountPaise / (statement?.memberCount || 4)))} / person
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        </View>

        {/* Per-Roommate Balance Reconciliation Table */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Roommate Balance Reconciliation</Text>

          <Card style={styles.memberCard}>
            {(statement?.memberStatements || []).map((m, idx) => (
              <View key={m.userId || idx} style={[styles.memberRow, idx > 0 && styles.memberBorder]}>
                <Avatar name={m.name} size="sm" />
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{m.name}</Text>
                  <View style={styles.shareFormulaRow}>
                    <Text style={styles.formulaText}>
                      Rent {formatPaise(m.rentSharePaise)} + Exp {formatPaise(m.expenseSharePaise)}
                    </Text>
                    {m.expensePaidPaise > 0 && (
                      <Text style={styles.creditText}>
                        - Paid {formatPaise(m.expensePaidPaise)}
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.memberNetCol}>
                  <Text style={[styles.memberNetText, { fontVariant: ['tabular-nums'] }]}>
                    {formatPaise(m.netAmountOwedPaise)}
                  </Text>
                  <Text style={styles.memberNetSub}>Net Owed</Text>
                </View>
              </View>
            ))}
          </Card>
        </View>

        {/* Share Button */}
        <View style={styles.footer}>
          <Button
            title="Share Statement Summary"
            variant="primary"
            size="lg"
            onPress={handleShare}
          />
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
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  closeBtn: { padding: space.xs },
  container: { padding: space.lg, paddingBottom: 60 },

  heroCard: {
    backgroundColor: colors.surface,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginBottom: space.lg,
  },
  heroPeriod: { fontSize: 11, fontWeight: '700', color: colors.inkSecondary, letterSpacing: 0.5 },
  heroFlatName: { fontSize: 18, fontWeight: '700', color: colors.ink, marginTop: 2 },
  heroTotal: { fontSize: 32, fontWeight: '800', color: colors.ink, marginVertical: space.xs },
  heroSub: { fontSize: 12, color: colors.inkSecondary },

  section: { marginBottom: space.lg },
  sectionHeader: { fontSize: 13, fontWeight: '700', color: colors.inkSecondary, textTransform: 'uppercase', marginBottom: space.xs },

  linesCard: { padding: 0, overflow: 'hidden' },
  lineItemRow: { flexDirection: 'row', alignItems: 'center', padding: space.md },
  lineItemBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  lineMain: { flex: 1 },
  lineTitleRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  lineTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  typeRent: { backgroundColor: colors.primarySoft },
  typeRentText: { color: colors.primary, fontSize: 9, fontWeight: '800' },
  typeExpense: { backgroundColor: colors.surfaceMuted },
  typeExpenseText: { color: colors.inkSecondary, fontSize: 9, fontWeight: '800' },
  linePayer: { fontSize: 12, color: colors.inkSecondary, marginTop: 2 },
  lineBilling: { fontSize: 11, color: colors.primary, marginTop: 2, fontWeight: '500' },
  lineAmountCol: { alignItems: 'flex-end', marginLeft: space.sm },
  lineAmount: { fontSize: 14, fontWeight: '700', color: colors.ink },
  lineSharePerHead: { fontSize: 11, color: colors.inkSecondary, marginTop: 2 },

  memberCard: { padding: 0, overflow: 'hidden' },
  memberRow: { flexDirection: 'row', alignItems: 'center', padding: space.md },
  memberBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  memberInfo: { flex: 1, marginLeft: space.md },
  memberName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  shareFormulaRow: { marginTop: 2 },
  formulaText: { fontSize: 11, color: colors.inkSecondary },
  creditText: { fontSize: 11, color: colors.success, fontWeight: '600' },
  memberNetCol: { alignItems: 'flex-end' },
  memberNetText: { fontSize: 16, fontWeight: '800', color: colors.primary },
  memberNetSub: { fontSize: 10, color: colors.inkSecondary, textTransform: 'uppercase' },

  footer: { marginTop: space.sm },
});
