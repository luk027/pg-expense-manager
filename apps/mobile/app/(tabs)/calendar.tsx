import React, { useState, useMemo } from 'react';
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
import { useExpenses, ExpenseItem } from '../../context/ExpenseContext';
import { useWaterService, WaterDeliveryItem } from '../../context/WaterServiceContext';
import { useRoom } from '../../context/RoomContext';
import { formatPaise } from '../../lib/utils';

// Category color mappings
function getCategoryColor(categoryName: string): { bg: string; text: string; dot: string } {
  const norm = categoryName.toLowerCase();
  if (norm.includes('water')) return { bg: '#E0F2FE', text: '#0369A1', dot: '#0284C7' };
  if (norm.includes('rent')) return { bg: '#EBF5FF', text: '#1E40AF', dot: '#1E40AF' };
  if (norm.includes('grocer') || norm.includes('food')) return { bg: '#ECFDF5', text: '#065F46', dot: '#059669' };
  if (norm.includes('wi-fi') || norm.includes('wifi') || norm.includes('internet'))
    return { bg: '#F3E8FF', text: '#6B21A8', dot: '#7C3AED' };
  if (norm.includes('electr') || norm.includes('power'))
    return { bg: '#FEF3C7', text: '#92400E', dot: '#D97706' };
  if (norm.includes('clean') || norm.includes('maid'))
    return { bg: '#FCE7F3', text: '#9D174D', dot: '#DB2777' };
  return { bg: colors.surfaceMuted, text: colors.inkSecondary, dot: '#64748B' };
}

function formatTime(timeStr: string): string {
  try {
    const [hh, mm] = timeStr.split(':');
    let h = parseInt(hh, 10);
    const m = mm || '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  } catch {
    return timeStr;
  }
}

export default function CalendarScreen() {
  const router = useRouter();
  const { room, categories } = useRoom();
  const {
    expenses,
    selectedPeriod,
    setSelectedPeriod,
    refreshExpenses,
    isLoading: isExpLoading,
  } = useExpenses();
  const {
    waterDeliveries,
    refreshDeliveries,
    isLoading: isWaterLoading,
  } = useWaterService();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Selected date state (defaults to today or 1st of month)
  const todayIST = useMemo(() => {
    return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().substring(0, 10);
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const currentMonthPrefix = todayIST.substring(0, 7);
    return selectedPeriod === currentMonthPrefix ? todayIST : `${selectedPeriod}-01`;
  });

  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (RNStatusBar.currentHeight || 28) : 0,
    24
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshExpenses(), refreshDeliveries()]);
    setRefreshing(false);
  };

  // Month navigation: cycling across months (YYYY-MM)
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
    setSelectedDate(`${newPeriod}-01`);
  };

  const formatPeriodDisplay = (periodStr: string) => {
    const [year, month] = periodStr.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Build category list for horizontal filters
  const filterCategories = useMemo(() => {
    const defaultCats = ['All', 'Water'];
    for (const c of categories) {
      if (!defaultCats.includes(c.name)) defaultCats.push(c.name);
    }
    return defaultCats;
  }, [categories]);

  // Aggregate items by date
  // Expenses in selectedPeriod
  const periodExpenses = useMemo(() => {
    return expenses.filter((e) => e.expensePeriod === selectedPeriod);
  }, [expenses, selectedPeriod]);

  // Water deliveries in selectedPeriod
  const periodWaterDeliveries = useMemo(() => {
    return waterDeliveries.filter((w) => w.expensePeriod === selectedPeriod);
  }, [waterDeliveries, selectedPeriod]);

  // Build calendar matrix for current selectedPeriod
  const { year, month, daysInMonth, firstDayWeekday, calendarCells } = useMemo(() => {
    const [yStr, mStr] = selectedPeriod.split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);

    const numDays = new Date(y, m, 0).getDate();
    const firstDay = new Date(y, m - 1, 1).getDay(); // 0 = Sun, 1 = Mon ...

    const cells: {
      day: number;
      dateStr: string;
      isCurrentMonth: boolean;
      dots: string[];
      totalAmountPaise: number;
    }[] = [];

    // Preceding empty padding
    for (let i = 0; i < firstDay; i++) {
      cells.push({
        day: 0,
        dateStr: '',
        isCurrentMonth: false,
        dots: [],
        totalAmountPaise: 0,
      });
    }

    // Days of current month
    for (let d = 1; d <= numDays; d++) {
      const dateStr = `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;

      // Check matching expenses
      const dayExps = periodExpenses.filter((e) => e.expenseDate === dateStr);
      // Check matching water
      const dayWater = periodWaterDeliveries.filter((w) => w.deliveryDate === dateStr);

      const dots: string[] = [];
      let totalAmountPaise = 0;

      // Filter logic: if category is 'All', include both; if specific, check match
      const includeWater = selectedCategory === 'All' || selectedCategory === 'Water';

      if (includeWater && dayWater.length > 0) {
        dots.push('#0284C7'); // Water dot
        totalAmountPaise += dayWater.reduce((sum, w) => sum + w.pricePaise, 0);
      }

      for (const exp of dayExps) {
        if (selectedCategory === 'All' || exp.categoryName.toLowerCase().includes(selectedCategory.toLowerCase())) {
          totalAmountPaise += exp.amountPaise;
          const dotColor = getCategoryColor(exp.categoryName).dot;
          if (!dots.includes(dotColor) && dots.length < 3) {
            dots.push(dotColor);
          }
        }
      }

      cells.push({
        day: d,
        dateStr,
        isCurrentMonth: true,
        dots,
        totalAmountPaise,
      });
    }

    return {
      year: y,
      month: m,
      daysInMonth: numDays,
      firstDayWeekday: firstDay,
      calendarCells: cells,
    };
  }, [selectedPeriod, periodExpenses, periodWaterDeliveries, selectedCategory]);

  // Selected date's detailed items
  const selectedDateExpenses = useMemo(() => {
    return periodExpenses.filter((e) => {
      const matchDate = e.expenseDate === selectedDate;
      if (!matchDate) return false;
      if (selectedCategory === 'All') return true;
      return e.categoryName.toLowerCase().includes(selectedCategory.toLowerCase());
    });
  }, [periodExpenses, selectedDate, selectedCategory]);

  const selectedDateWater = useMemo(() => {
    if (selectedCategory !== 'All' && selectedCategory !== 'Water') return [];
    return periodWaterDeliveries.filter((w) => w.deliveryDate === selectedDate);
  }, [periodWaterDeliveries, selectedDate, selectedCategory]);

  const selectedDateTotalPaise = useMemo(() => {
    const expTotal = selectedDateExpenses.reduce((sum, e) => sum + e.amountPaise, 0);
    const waterTotal = selectedDateWater.reduce((sum, w) => sum + w.pricePaise, 0);
    return expTotal + waterTotal;
  }, [selectedDateExpenses, selectedDateWater]);

  // Monthly summary stats
  const totalMonthExpensesPaise = periodExpenses.reduce((sum, e) => sum + e.amountPaise, 0);
  const totalMonthWaterPaise = periodWaterDeliveries.reduce((sum, w) => sum + w.pricePaise, 0);
  const totalMonthGrandPaise = totalMonthExpensesPaise + totalMonthWaterPaise;

  const activeDaysCount = useMemo(() => {
    const datesSet = new Set<string>();
    periodExpenses.forEach((e) => datesSet.add(e.expenseDate));
    periodWaterDeliveries.forEach((w) => datesSet.add(w.deliveryDate));
    return datesSet.size;
  }, [periodExpenses, periodWaterDeliveries]);

  // Format header for selected date
  const formatSelectedDateHeader = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-');
      const dt = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
      return dt.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <View style={styles.headerTitleCol}>
          <Text style={styles.title} numberOfLines={1}>Expense Calendar</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {room?.name || 'Flat 302, Green Glen'} • Daily Spend Timeline
          </Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            style={styles.headerBtn}
            onPress={() => router.push('/water-delivery')}
          >
            <Feather name="droplet" size={13} color="#0284C7" />
            <Text style={[styles.headerBtnText, { color: '#0284C7' }]}>Water</Text>
          </Pressable>

          <Pressable
            style={styles.headerBtnPrimary}
            onPress={() => router.push('/add-expense')}
          >
            <Feather name="plus" size={13} color="#FFFFFF" />
            <Text style={styles.headerBtnTextPrimary}>Add</Text>
          </Pressable>
        </View>
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

      {/* Horizontal Category Filters */}
      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {filterCategories.map((cat) => {
            const isActive = selectedCategory === cat;
            const cColor = cat === 'All' ? colors.primary : getCategoryColor(cat).dot;

            return (
              <Pressable
                key={cat}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setSelectedCategory(cat)}
              >
                {cat !== 'All' && (
                  <View style={[styles.filterDot, { backgroundColor: cColor }]} />
                )}
                <Text
                  style={[styles.filterChipText, isActive && styles.filterChipTextActive]}
                >
                  {cat}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Calendar Grid Card */}
        <Card style={styles.calendarCard}>
          {/* Weekday headers */}
          <View style={styles.weekDaysRow}>
            {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((w, i) => (
              <Text key={i} style={styles.weekDayHeader}>
                {w}
              </Text>
            ))}
          </View>

          {/* Grid Cells */}
          <View style={styles.daysGrid}>
            {calendarCells.map((cell, idx) => {
              if (!cell.isCurrentMonth) {
                return <View key={`pad-${idx}`} style={styles.emptyDayCell} />;
              }

              const isSelected = cell.dateStr === selectedDate;
              const isToday = cell.dateStr === todayIST;

              return (
                <Pressable
                  key={cell.dateStr}
                  style={[
                    styles.dayCell,
                    isSelected && styles.dayCellSelected,
                    isToday && !isSelected && styles.dayCellToday,
                  ]}
                  onPress={() => setSelectedDate(cell.dateStr)}
                >
                  <Text
                    style={[
                      styles.dayText,
                      isSelected && styles.dayTextSelected,
                      isToday && !isSelected && styles.dayTextToday,
                    ]}
                  >
                    {cell.day}
                  </Text>

                  {/* Indicator Dots */}
                  <View style={styles.dotsRow}>
                    {cell.dots.map((dotColor, dIdx) => (
                      <View
                        key={dIdx}
                        style={[
                          styles.indicatorDot,
                          {
                            backgroundColor: isSelected ? '#FFFFFF' : dotColor,
                          },
                        ]}
                      />
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* Monthly Summary Statistics Strip */}
        <View style={styles.monthStatsStrip}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>MONTH TOTAL</Text>
            <Text style={[styles.statValue, { fontVariant: ['tabular-nums'] }]}>
              {formatPaise(totalMonthGrandPaise)}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>ACTIVE DAYS</Text>
            <Text style={styles.statValue}>{activeDaysCount} Days</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>WATER CANS</Text>
            <Text style={styles.statValue}>{periodWaterDeliveries.length} Jugs</Text>
          </View>
        </View>

        {/* Selected Date Detail Section */}
        <View style={styles.selectedDateSection}>
          <View style={styles.dateSectionHeaderRow}>
            <View>
              <Text style={styles.selectedDateTitle}>
                {formatSelectedDateHeader(selectedDate)}
              </Text>
              <Text style={styles.selectedDateSub}>
                {selectedDateExpenses.length + selectedDateWater.length} entries on this day
              </Text>
            </View>

            {selectedDateTotalPaise > 0 && (
              <View style={styles.dayTotalBadge}>
                <Text style={[styles.dayTotalText, { fontVariant: ['tabular-nums'] }]}>
                  {formatPaise(selectedDateTotalPaise)}
                </Text>
              </View>
            )}
          </View>

          {/* List of Entries for Selected Date */}
          {selectedDateExpenses.length === 0 && selectedDateWater.length === 0 ? (
            <EmptyState
              icon="calendar"
              title="No Expenses on this Date"
              description={`No shared expenses or water deliveries recorded for ${selectedDate}.`}
              actionTitle="+ Add Expense"
              onActionPress={() => router.push(`/add-expense?date=${selectedDate}`)}
            />
          ) : (
            <Card style={styles.entriesCard}>
              {/* Shared Expenses */}
              {selectedDateExpenses.map((exp, idx) => {
                const cColor = getCategoryColor(exp.categoryName);
                return (
                  <Pressable
                    key={exp.id}
                    style={[styles.entryRow, idx > 0 && styles.entryBorder]}
                    onPress={() => router.push(`/expense-detail?id=${exp.id}`)}
                  >
                    <View style={[styles.entryIconBox, { backgroundColor: cColor.bg }]}>
                      <Feather name="file-text" size={16} color={cColor.text} />
                    </View>

                    <View style={styles.entryDetails}>
                      <Text style={styles.entryTitle}>{exp.name || exp.categoryName}</Text>
                      <View style={styles.entryMeta}>
                        <View style={[styles.catPill, { backgroundColor: cColor.bg }]}>
                          <Text style={[styles.catPillText, { color: cColor.text }]}>
                            {exp.categoryName}
                          </Text>
                        </View>
                        <Text style={styles.entryPaidBy}>• Paid by {exp.paidByName}</Text>
                      </View>
                    </View>

                    <View style={styles.entryAmountCol}>
                      <Text style={[styles.entryAmount, { fontVariant: ['tabular-nums'] }]}>
                        {formatPaise(exp.amountPaise)}
                      </Text>
                      <Feather name="chevron-right" size={14} color={colors.inkTertiary} />
                    </View>
                  </Pressable>
                );
              })}

              {/* Water Deliveries for this Date */}
              {selectedDateWater.map((w, idx) => {
                const isFirst = selectedDateExpenses.length === 0 && idx === 0;
                return (
                  <Pressable
                    key={w.id}
                    style={[styles.entryRow, !isFirst && styles.entryBorder]}
                    onPress={() => router.push('/water-delivery')}
                  >
                    <View style={[styles.entryIconBox, { backgroundColor: '#E0F2FE' }]}>
                      <Feather name="droplet" size={16} color="#0284C7" />
                    </View>

                    <View style={styles.entryDetails}>
                      <Text style={styles.entryTitle}>Water Delivery (20L Jug)</Text>
                      <View style={styles.entryMeta}>
                        <View style={[styles.catPill, { backgroundColor: '#E0F2FE' }]}>
                          <Text style={[styles.catPillText, { color: '#0369A1' }]}>
                            {formatTime(w.deliveryTime)}
                          </Text>
                        </View>
                        <Text style={styles.entryPaidBy}>• Logged by {w.recordedByName}</Text>
                      </View>
                    </View>

                    <View style={styles.entryAmountCol}>
                      <Text style={[styles.entryAmount, { fontVariant: ['tabular-nums'] }]}>
                        {formatPaise(w.pricePaise)}
                      </Text>
                      <Feather name="chevron-right" size={14} color={colors.inkTertiary} />
                    </View>
                  </Pressable>
                );
              })}
            </Card>
          )}
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
  headerTitleCol: { flex: 1, marginRight: space.sm },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink },
  subtitle: { fontSize: 11, color: colors.inkSecondary, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm + 4,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: '#E0F2FE',
    gap: 4,
  },
  headerBtnText: { fontSize: 11, fontWeight: '700' },
  headerBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm + 4,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    gap: 4,
  },
  headerBtnTextPrimary: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },

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

  filterSection: {
    backgroundColor: colors.surface,
    paddingVertical: space.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterRow: { paddingHorizontal: space.lg, gap: 6, alignItems: 'center' },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm + 4,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 5,
  },
  filterChipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  filterDot: { width: 6, height: 6, borderRadius: 3 },
  filterChipText: { fontSize: 11, fontWeight: '600', color: colors.inkSecondary },
  filterChipTextActive: { color: colors.primary, fontWeight: '700' },

  container: { padding: space.lg, paddingBottom: 60 },

  calendarCard: { padding: space.md, marginBottom: space.md },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: space.xs,
  },
  weekDayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '800',
    color: colors.inkTertiary,
  },

  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  emptyDayCell: {
    width: '14.28%',
    height: 48,
  },
  dayCell: {
    width: '14.28%',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  dayCellSelected: {
    backgroundColor: colors.primary,
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  dayText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  dayTextToday: {
    color: colors.primary,
    fontWeight: '800',
  },

  dotsRow: {
    flexDirection: 'row',
    gap: 3,
    height: 6,
    marginTop: 2,
    alignItems: 'center',
  },
  indicatorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  monthStatsStrip: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: space.lg,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statBox: { alignItems: 'center' },
  statLabel: { fontSize: 9, fontWeight: '800', color: colors.inkSecondary, letterSpacing: 0.5 },
  statValue: { fontSize: 14, fontWeight: '800', color: colors.ink, marginTop: 2 },
  statDivider: { width: 1, height: 24, backgroundColor: colors.border },

  selectedDateSection: { gap: space.sm },
  dateSectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  selectedDateTitle: { fontSize: 15, fontWeight: '800', color: colors.ink },
  selectedDateSub: { fontSize: 11, color: colors.inkSecondary, marginTop: 1 },
  dayTotalBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: space.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  dayTotalText: { fontSize: 13, fontWeight: '800', color: colors.primary },

  entriesCard: { padding: 0, overflow: 'hidden' },
  entryRow: { flexDirection: 'row', alignItems: 'center', padding: space.md },
  entryBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  entryIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.sm + 2,
  },
  entryDetails: { flex: 1 },
  entryTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
  entryMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 4 },
  catPill: { paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: radius.pill },
  catPillText: { fontSize: 10, fontWeight: '700' },
  entryPaidBy: { fontSize: 11, color: colors.inkSecondary },
  entryAmountCol: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  entryAmount: { fontSize: 14, fontWeight: '800', color: colors.ink },
});
