import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TextInput,
  Pressable,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Card, Button, Avatar } from '../components/ui';
import { colors, space, radius } from '../lib/tokens';
import { useAuth } from '../context/AuthContext';
import { useRoom } from '../context/RoomContext';
import { useExpenses } from '../context/ExpenseContext';
import { formatPaise } from '../lib/utils';

export default function AddExpenseScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { room, activeMembers, categories } = useRoom();
  const { addExpense } = useExpenses();

  const todayStr = new Date().toISOString().split('T')[0];

  const [name, setName] = useState('');
  const [rupeesText, setRupeesText] = useState('');
  const activeCategories = categories.filter((c) => c.isActive !== false);
  const [categoryId, setCategoryId] = useState(activeCategories[0]?.id || 'c1');
  const [paidByUserId, setPaidByUserId] = useState(user?.id || '');
  const [expenseDate, setExpenseDate] = useState(todayStr);
  const [isMultiMonth, setIsMultiMonth] = useState(false);
  const [billingStart, setBillingStart] = useState('');
  const [billingEnd, setBillingEnd] = useState('');
  const [settlementPref, setSettlementPref] = useState<'monthly' | 'immediate'>('monthly');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Compute live paise amount & per-person share preview
  const numRupees = parseFloat(rupeesText.replace(/,/g, '')) || 0;
  const amountPaise = Math.round(numRupees * 100);
  const memberCount = Math.max(activeMembers.length, 1);
  const perPersonPaise = Math.round(amountPaise / memberCount);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a description for the expense.');
      return;
    }
    if (amountPaise <= 0) {
      Alert.alert('Required', 'Please enter a valid expense amount greater than ₹0.');
      return;
    }
    if (!categoryId) {
      Alert.alert('Required', 'Please select a category.');
      return;
    }
    if (!paidByUserId) {
      Alert.alert('Required', 'Please select who paid this expense.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await addExpense({
        name: name.trim(),
        amountPaise,
        categoryId,
        paidByUserId,
        expenseDate,
        settlementPreference: settlementPref,
        billingPeriodStart: isMultiMonth && billingStart ? billingStart : null,
        billingPeriodEnd: isMultiMonth && billingEnd ? billingEnd : null,
      });

      if (res.success) {
        router.back();
      } else {
        Alert.alert('Error', res.error || 'Failed to add expense');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Add Expense</Text>
          <Text style={styles.headerSubtitle}>{room?.name || 'Shared Flat'}</Text>
        </View>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Feather name="x" size={22} color={colors.inkSecondary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Amount Input Hero */}
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Total Expense Amount</Text>
          <View style={styles.amountInputRow}>
            <Text style={styles.rupeeSymbol}>₹</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0"
              placeholderTextColor={colors.inkTertiary}
              keyboardType="numeric"
              value={rupeesText}
              onChangeText={setRupeesText}
              autoFocus
            />
          </View>

          {amountPaise > 0 && (
            <View style={styles.splitPreview}>
              <Feather name="pie-chart" size={14} color={colors.primary} />
              <Text style={styles.splitPreviewText}>
                Split equally among {memberCount} roommates: {formatPaise(perPersonPaise)} / person
              </Text>
            </View>
          )}
        </View>

        {/* Expense Description */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>What was this for?</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Blinkit Groceries, Airtel Wi-Fi, Water Cans"
            placeholderTextColor={colors.inkTertiary}
            value={name}
            onChangeText={setName}
            maxLength={100}
          />
        </View>

        {/* Category Picker */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {activeCategories.map((cat) => {
              const isSelected = categoryId === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                  onPress={() => setCategoryId(cat.id)}
                >
                  <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextActive]}>
                    {cat.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Paid By Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Paid By</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {activeMembers.map((m) => {
              const isSelected = paidByUserId === m.userId;
              return (
                <Pressable
                  key={m.id}
                  style={[styles.payerChip, isSelected && styles.payerChipActive]}
                  onPress={() => setPaidByUserId(m.userId)}
                >
                  <Avatar name={m.name} size="sm" />
                  <Text style={[styles.payerChipText, isSelected && styles.payerChipTextActive]}>
                    {m.userId === user?.id ? `${m.name} (You)` : m.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Date Field */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Expense Date (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.textInput}
            value={expenseDate}
            onChangeText={setExpenseDate}
            placeholder="YYYY-MM-DD"
          />
        </View>

        {/* Multi-month utility toggle */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleLabelCol}>
            <Text style={styles.toggleTitle}>Multi-Month Utility Bill</Text>
            <Text style={styles.toggleDesc}>E.g. Bi-monthly electricity (Sep–Oct)</Text>
          </View>
          <Switch
            value={isMultiMonth}
            onValueChange={setIsMultiMonth}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>

        {isMultiMonth && (
          <View style={styles.multiMonthCard}>
            <View style={styles.dateCol}>
              <Text style={styles.dateFieldLabel}>Billing Start</Text>
              <TextInput
                style={styles.dateInput}
                placeholder="2026-09-01"
                value={billingStart}
                onChangeText={setBillingStart}
              />
            </View>
            <View style={styles.dateCol}>
              <Text style={styles.dateFieldLabel}>Billing End</Text>
              <TextInput
                style={styles.dateInput}
                placeholder="2026-10-31"
                value={billingEnd}
                onChangeText={setBillingEnd}
              />
            </View>
          </View>
        )}

        {/* Settlement Preference */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Settlement Cycle</Text>
          <View style={styles.prefRow}>
            <Pressable
              style={[styles.prefBtn, settlementPref === 'monthly' && styles.prefBtnActive]}
              onPress={() => setSettlementPref('monthly')}
            >
              <Feather
                name="calendar"
                size={16}
                color={settlementPref === 'monthly' ? colors.primary : colors.inkSecondary}
              />
              <Text style={[styles.prefBtnText, settlementPref === 'monthly' && styles.prefBtnTextActive]}>
                Monthly Settlement (on {room?.settlementDay || 28}th)
              </Text>
            </Pressable>

            <Pressable
              style={[styles.prefBtn, settlementPref === 'immediate' && styles.prefBtnActive]}
              onPress={() => setSettlementPref('immediate')}
            >
              <Feather
                name="zap"
                size={16}
                color={settlementPref === 'immediate' ? colors.primary : colors.inkSecondary}
              />
              <Text style={[styles.prefBtnText, settlementPref === 'immediate' && styles.prefBtnTextActive]}>
                Immediate Settlement
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Action Button */}
        <View style={styles.footer}>
          <Button
            title={isSubmitting ? 'Recording Expense...' : 'Record Expense'}
            variant="primary"
            size="lg"
            onPress={handleSubmit}
            disabled={isSubmitting}
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
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  headerSubtitle: { fontSize: 12, color: colors.inkSecondary, marginTop: 2 },
  closeBtn: { padding: space.xs },
  container: { padding: space.lg, paddingBottom: space.xxl },

  amountCard: {
    backgroundColor: colors.surface,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginBottom: space.lg,
  },
  amountLabel: { fontSize: 12, fontWeight: '600', color: colors.inkSecondary, textTransform: 'uppercase' },
  amountInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.sm },
  rupeeSymbol: { fontSize: 36, fontWeight: '700', color: colors.ink, marginRight: space.xs },
  amountInput: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.ink,
    minWidth: 120,
    textAlign: 'center',
  },
  splitPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    marginTop: space.md,
    gap: space.xs,
  },
  splitPreviewText: { fontSize: 12, fontWeight: '600', color: colors.primary },

  section: { marginBottom: space.lg },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: colors.inkSecondary, marginBottom: space.xs },
  textInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    fontSize: 15,
    color: colors.ink,
  },

  chipRow: { flexDirection: 'row', gap: space.sm, paddingVertical: space.xs },
  categoryChip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: { fontSize: 13, fontWeight: '600', color: colors.inkSecondary },
  categoryChipTextActive: { color: '#FFFFFF' },

  payerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    gap: space.xs,
  },
  payerChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  payerChipText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  payerChipTextActive: { color: colors.primary, fontWeight: '700' },

  toggleRow: {
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
  toggleLabelCol: { flex: 1 },
  toggleTitle: { fontSize: 14, fontWeight: '600', color: colors.ink },
  toggleDesc: { fontSize: 12, color: colors.inkSecondary, marginTop: 2 },

  multiMonthCard: {
    flexDirection: 'row',
    gap: space.md,
    backgroundColor: colors.surface,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: space.lg,
  },
  dateCol: { flex: 1 },
  dateFieldLabel: { fontSize: 11, fontWeight: '600', color: colors.inkSecondary, marginBottom: 4 },
  dateInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    fontSize: 13,
    color: colors.ink,
  },

  prefRow: { gap: space.sm },
  prefBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.sm,
  },
  prefBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  prefBtnText: { fontSize: 13, color: colors.inkSecondary, fontWeight: '500' },
  prefBtnTextActive: { color: colors.primary, fontWeight: '700' },

  footer: { marginTop: space.md },
});
