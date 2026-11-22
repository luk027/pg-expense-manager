import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Pressable,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Card, Button, Avatar } from '../components/ui';
import { colors, space, radius } from '../lib/tokens';
import { useExpenses } from '../context/ExpenseContext';
import { useAuth } from '../context/AuthContext';
import { formatPaise } from '../lib/utils';

export default function ExpenseDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getExpenseById, deleteExpense } = useExpenses();
  const { user } = useAuth();

  const expense = id ? getExpenseById(id) : undefined;

  if (!expense) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Expense record not found</Text>
          <Button title="Go Back" variant="outline" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const handleDelete = () => {
    Alert.alert(
      'Delete Expense',
      `Are you sure you want to delete "${expense.name}"? This action will remove it from the shared ledger.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const res = await deleteExpense(expense.id);
            if (res.success) {
              router.back();
            } else {
              Alert.alert('Error', res.error || 'Failed to delete expense');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Expense Details</Text>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Feather name="x" size={20} color={colors.inkSecondary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Main Amount Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.categoryPill}>
            <Text style={styles.categoryPillText}>{expense.categoryName}</Text>
          </View>
          <Text style={styles.expenseName}>{expense.name}</Text>
          <Text style={styles.amountText}>{formatPaise(expense.amountPaise)}</Text>
          <Text style={styles.dateSubtext}>Expense Date: {expense.expenseDate}</Text>

          {expense.billingPeriodStart && expense.billingPeriodEnd && (
            <View style={styles.billingBanner}>
              <Feather name="info" size={13} color={colors.primary} />
              <Text style={styles.billingBannerText}>
                Billing period: {expense.billingPeriodStart} to {expense.billingPeriodEnd}
              </Text>
            </View>
          )}
        </View>

        {/* Paid By Card */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Paid By</Text>
          <View style={styles.payerCard}>
            <Avatar name={expense.paidByName} size="md" />
            <View style={styles.payerInfo}>
              <Text style={styles.payerName}>{expense.paidByName}</Text>
              <Text style={styles.payerSub}>
                {expense.paidByUserId === user?.id ? 'Paid by you in full' : 'Roommate payment recorded'}
              </Text>
            </View>
            <View style={styles.settleBadge}>
              <Text style={styles.settleBadgeText}>
                {expense.settlementPreference === 'monthly' ? 'Monthly Cycle' : 'Immediate'}
              </Text>
            </View>
          </View>
        </View>

        {/* Equal Shares Breakdown */}
        <View style={styles.section}>
          <View style={styles.sharesHeaderRow}>
            <Text style={styles.sectionHeader}>Split Breakdown ({expense.shares.length} Roommates)</Text>
            <Text style={styles.equalNote}>Equal paise split</Text>
          </View>

          <Card style={styles.sharesCard}>
            {expense.shares.map((share, idx) => {
              const isCurrentUser = share.userId === user?.id;
              return (
                <View key={share.userId || idx} style={[styles.shareRow, idx > 0 && styles.shareBorder]}>
                  <Avatar name={share.userName} size="sm" />
                  <View style={styles.shareUserInfo}>
                    <Text style={styles.shareUserName}>
                      {share.userName} {isCurrentUser ? '(You)' : ''}
                    </Text>
                    <Text style={styles.shareUserSub}>
                      {isCurrentUser && share.userId === expense.paidByUserId
                        ? 'Your net cost'
                        : isCurrentUser
                        ? 'You owe payer'
                        : 'Roommate share'}
                    </Text>
                  </View>
                  <Text style={[styles.shareAmount, { fontVariant: ['tabular-nums'] }]}>
                    {formatPaise(share.sharePaise)}
                  </Text>
                </View>
              );
            })}
          </Card>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionBtn, styles.editBtn]}
            onPress={() => router.push(`/edit-expense?id=${expense.id}`)}
          >
            <Feather name="edit-2" size={16} color={colors.primary} />
            <Text style={styles.editBtnText}>Edit</Text>
          </Pressable>

          <Pressable style={[styles.actionBtn, styles.deleteBtn]} onPress={handleDelete}>
            <Feather name="trash-2" size={16} color={colors.danger} />
            <Text style={styles.deleteBtnText}>Delete</Text>
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
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  closeBtn: { padding: space.xs },
  container: { padding: space.lg, paddingBottom: space.xxl },

  notFound: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space.xl },
  notFoundText: { fontSize: 16, color: colors.inkSecondary, marginBottom: space.md },

  heroCard: {
    backgroundColor: colors.surface,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginBottom: space.lg,
  },
  categoryPill: {
    paddingHorizontal: space.md,
    paddingVertical: 4,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    marginBottom: space.sm,
  },
  categoryPillText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  expenseName: { fontSize: 20, fontWeight: '700', color: colors.ink, textAlign: 'center', marginBottom: space.xs },
  amountText: { fontSize: 32, fontWeight: '800', color: colors.ink, marginVertical: space.xs },
  dateSubtext: { fontSize: 12, color: colors.inkSecondary },

  billingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.sm,
    marginTop: space.sm,
    gap: space.xs,
  },
  billingBannerText: { fontSize: 11, fontWeight: '600', color: colors.primary },

  section: { marginBottom: space.lg },
  sectionHeader: { fontSize: 13, fontWeight: '600', color: colors.inkSecondary, textTransform: 'uppercase', marginBottom: space.xs },
  sharesHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.xs },
  equalNote: { fontSize: 11, fontWeight: '600', color: colors.primary },

  payerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: space.md,
  },
  payerInfo: { flex: 1 },
  payerName: { fontSize: 15, fontWeight: '700', color: colors.ink },
  payerSub: { fontSize: 12, color: colors.inkSecondary, marginTop: 2 },
  settleBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  settleBadgeText: { fontSize: 11, fontWeight: '600', color: colors.primary },

  sharesCard: { padding: 0 },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
    gap: space.md,
  },
  shareBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  shareUserInfo: { flex: 1 },
  shareUserName: { fontSize: 14, fontWeight: '600', color: colors.ink },
  shareUserSub: { fontSize: 11, color: colors.inkSecondary, marginTop: 2 },
  shareAmount: { fontSize: 15, fontWeight: '700', color: colors.ink },

  actionRow: { flexDirection: 'row', gap: space.md, marginTop: space.sm },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: space.xs,
  },
  editBtn: { borderColor: colors.primary, backgroundColor: colors.surface },
  editBtnText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  deleteBtn: { borderColor: colors.danger, backgroundColor: colors.surface },
  deleteBtnText: { fontSize: 14, fontWeight: '700', color: colors.danger },
});
