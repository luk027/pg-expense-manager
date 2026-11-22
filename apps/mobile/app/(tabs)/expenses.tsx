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
import { Card, Button, Avatar, EmptyState } from '../../components/ui';
import { colors, space, radius } from '../../lib/tokens';
import { useAuth } from '../../context/AuthContext';
import { useRoom } from '../../context/RoomContext';
import { useExpenses, ExpenseItem } from '../../context/ExpenseContext';
import { formatPaise } from '../../lib/utils';

// Helper to format date header
function formatExpenseDateHeader(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// Category badge color mapping
function getCategoryColor(categoryName: string): { bg: string; text: string } {
  const norm = categoryName.toLowerCase();
  if (norm.includes('rent')) return { bg: '#EBF5FF', text: '#1E40AF' };
  if (norm.includes('wi-fi') || norm.includes('wifi')) return { bg: '#F3E8FF', text: '#6B21A8' };
  if (norm.includes('grocer')) return { bg: '#ECFDF5', text: '#065F46' };
  if (norm.includes('water')) return { bg: '#E0F2FE', text: '#0369A1' };
  if (norm.includes('electr')) return { bg: '#FEF3C7', text: '#92400E' };
  if (norm.includes('clean')) return { bg: '#FCE7F3', text: '#9D174D' };
  return { bg: colors.border, text: colors.inkSecondary };
}

export default function ExpensesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { room, activeMembers, categories } = useRoom();
  const {
    expenses,
    selectedPeriod,
    setSelectedPeriod,
    selectedCategory,
    setSelectedCategory,
    totalAmountPaise,
    isLoading,
    refreshExpenses,
  } = useExpenses();

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshExpenses();
    setRefreshing(false);
  };

  // Month navigation: cycle between Oct 2026, Nov 2026, Dec 2026
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

  // Group expenses by expenseDate
  const groupedExpenses = React.useMemo(() => {
    const groups: { date: string; items: ExpenseItem[] }[] = [];
    const map = new Map<string, ExpenseItem[]>();

    for (const exp of expenses) {
      const list = map.get(exp.expenseDate) || [];
      list.push(exp);
      map.set(exp.expenseDate, list);
    }

    const sortedDates = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));
    for (const date of sortedDates) {
      groups.push({ date, items: map.get(date) || [] });
    }

    return groups;
  }, [expenses]);

  // Compute current user's total personal share in this period
  const userShareTotalPaise = React.useMemo(() => {
    let total = 0;
    for (const exp of expenses) {
      const myShare = exp.shares.find((s) => s.userId === user?.id);
      if (myShare) {
        total += myShare.sharePaise;
      } else {
        total += Math.round(exp.amountPaise / Math.max(activeMembers.length, 1));
      }
    }
    return total;
  }, [expenses, user?.id, activeMembers.length]);

  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (RNStatusBar.currentHeight || 28) : 0,
    24
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <View style={{ flex: 1, marginRight: space.sm }}>
          <Text style={styles.title} numberOfLines={1}>Shared Expenses</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {room?.name || 'Shared Flat'} • {activeMembers.length} Roommates
          </Text>
        </View>
        <Pressable style={styles.addBtn} onPress={() => router.push('/add-expense')}>
          <Feather name="plus" size={16} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
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
        {/* Spend Overview Summary Card */}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>Total Shared Spend</Text>
              <Text style={styles.summaryAmount}>{formatPaise(totalAmountPaise)}</Text>
              <Text style={styles.summarySub}>
                Across {expenses.length} shared {expenses.length === 1 ? 'expense' : 'expenses'}
              </Text>
            </View>

            <View style={styles.summaryColRight}>
              <Text style={styles.summaryLabel}>Your Total Share</Text>
              <Text style={styles.userShareAmount}>{formatPaise(userShareTotalPaise)}</Text>
              <Text style={styles.summarySub}>Equal {activeMembers.length}-way split</Text>
            </View>
          </View>
        </Card>

        {/* Quick Shortcut to Water Deliveries */}
        <Pressable
          style={styles.waterQuickBanner}
          onPress={() => router.push('/water-delivery')}
        >
          <View style={styles.waterQuickLeft}>
            <View style={styles.waterIconBox}>
              <Feather name="droplet" size={16} color="#0284C7" />
            </View>
            <View>
              <Text style={styles.waterQuickTitle}>Water Deliveries Tracker</Text>
              <Text style={styles.waterQuickSub}>1-touch log • Active rate ₹40 / delivery</Text>
            </View>
          </View>
          <Feather name="chevron-right" size={18} color="#0284C7" />
        </Pressable>

        {/* Category Filter Chips */}
        <View style={styles.categoryFilterSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipRow}>
            <Pressable
              style={[styles.filterChip, selectedCategory === null && styles.filterChipActive]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text style={[styles.filterChipText, selectedCategory === null && styles.filterChipTextActive]}>
                All Categories ({expenses.length})
              </Text>
            </Pressable>

            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  style={[styles.filterChip, isSelected && styles.filterChipActive]}
                  onPress={() => setSelectedCategory(isSelected ? null : cat.id)}
                >
                  <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                    {cat.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Empty State */}
        {groupedExpenses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <EmptyState
              icon="coffee"
              title="No expenses for this month"
              description="Keep your shared ledger up to date. Tap the button below to add your first expense."
              actionTitle="Add Expense"
              onActionPress={() => router.push('/add-expense')}
            />
          </View>
        ) : (
          /* Expense Groups by Date */
          groupedExpenses.map((group) => (
            <View key={group.date} style={styles.group}>
              <Text style={styles.groupDate}>{formatExpenseDateHeader(group.date)}</Text>
              <Card style={styles.groupCard}>
                {group.items.map((item, idx) => {
                  const catColor = getCategoryColor(item.categoryName);
                  const isPayer = item.paidByUserId === user?.id;
                  const myShare = item.shares.find((s) => s.userId === user?.id)?.sharePaise;
                  const fallbackShare = Math.round(item.amountPaise / Math.max(activeMembers.length, 1));

                  return (
                    <Pressable
                      key={item.id}
                      style={[styles.itemRow, idx > 0 && styles.itemBorder]}
                      onPress={() => router.push(`/expense-detail?id=${item.id}`)}
                    >
                      <View style={styles.itemMain}>
                        <Text style={styles.itemName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <View style={styles.metaRow}>
                          <View style={[styles.categoryBadge, { backgroundColor: catColor.bg }]}>
                            <Text style={[styles.categoryBadgeText, { color: catColor.text }]}>
                              {item.categoryName}
                            </Text>
                          </View>
                          <Text style={styles.paidByText}>
                            {isPayer ? 'Paid by you' : `Paid by ${item.paidByName}`}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.amountCol}>
                        <Text style={[styles.amountText, { fontVariant: ['tabular-nums'] }]}>
                          {formatPaise(item.amountPaise)}
                        </Text>
                        <Text style={styles.splitText}>
                          Your share: {formatPaise(myShare !== undefined ? myShare : fallbackShare)}
                        </Text>
                      </View>

                      <Feather name="chevron-right" size={16} color={colors.inkTertiary} style={styles.chevron} />
                    </Pressable>
                  );
                })}
              </Card>
            </View>
          ))
        )}
      </ScrollView>

      {/* Floating Action Button (FAB) */}
      <Pressable style={styles.fab} onPress={() => router.push('/add-expense')}>
        <Feather name="plus" size={24} color="#FFFFFF" />
      </Pressable>
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
    paddingTop: space.md,
    paddingBottom: space.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 22, fontWeight: '700', color: colors.ink },
  subtitle: { fontSize: 12, color: colors.inkSecondary, marginTop: 2 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radius.pill,
    gap: 4,
  },
  addBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

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

  container: { padding: space.lg, paddingBottom: 90 },

  summaryCard: {
    backgroundColor: colors.surface,
    padding: space.md + 2,
    borderRadius: radius.lg,
    marginBottom: space.md,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryCol: { flex: 1 },
  summaryColRight: { alignItems: 'flex-end' },
  summaryLabel: { fontSize: 11, fontWeight: '600', color: colors.inkSecondary, textTransform: 'uppercase' },
  summaryAmount: { fontSize: 20, fontWeight: '800', color: colors.ink, marginTop: 2 },
  userShareAmount: { fontSize: 20, fontWeight: '800', color: colors.primary, marginTop: 2 },
  summarySub: { fontSize: 11, color: colors.inkTertiary, marginTop: 2 },

  waterQuickBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.md,
  },
  waterQuickLeft: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  waterIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waterQuickTitle: { fontSize: 13, fontWeight: '700', color: colors.ink },
  waterQuickSub: { fontSize: 11, color: colors.inkSecondary, marginTop: 1 },

  categoryFilterSection: { marginBottom: space.md },
  filterChipRow: { flexDirection: 'row', gap: space.xs },
  filterChip: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: 12, fontWeight: '600', color: colors.inkSecondary },
  filterChipTextActive: { color: '#FFFFFF' },

  emptyContainer: { marginTop: space.xl, paddingHorizontal: space.md },

  group: { marginBottom: space.md },
  groupDate: { fontSize: 12, fontWeight: '600', color: colors.inkSecondary, marginBottom: space.xs, textTransform: 'uppercase' },
  groupCard: { padding: 0, overflow: 'hidden' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
  },
  itemBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  itemMain: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: colors.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: 4 },
  categoryBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  categoryBadgeText: { fontSize: 10, fontWeight: '700' },
  paidByText: { fontSize: 12, color: colors.inkSecondary },
  amountCol: { alignItems: 'flex-end', marginLeft: space.sm },
  amountText: { fontSize: 15, fontWeight: '700', color: colors.ink },
  splitText: { fontSize: 11, color: colors.inkSecondary, marginTop: 2 },
  chevron: { marginLeft: space.xs },

  fab: {
    position: 'absolute',
    right: space.lg,
    bottom: space.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
});
