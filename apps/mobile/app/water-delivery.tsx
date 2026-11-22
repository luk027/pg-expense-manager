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
import { useWaterService, WaterDeliveryItem } from '../context/WaterServiceContext';
import { useRoom } from '../context/RoomContext';
import { formatPaise } from '../lib/utils';

// Helper to format date header
function formatDateHeader(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// Helper to format time display
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

export default function WaterDeliveryScreen() {
  const router = useRouter();
  const { room, isAdmin, activeMembers } = useRoom();
  const {
    waterDeliveries,
    serviceConfig,
    selectedPeriod,
    setSelectedPeriod,
    recordQuickDelivery,
    undoLastDelivery,
    deleteDelivery,
    lastAddedDelivery,
    undoSecondsLeft,
    refreshDeliveries,
  } = useWaterService();

  const [refreshing, setRefreshing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (RNStatusBar.currentHeight || 28) : 0,
    24
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshDeliveries();
    setRefreshing(false);
  };

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

    setSelectedPeriod(`${year}-${month.toString().padStart(2, '0')}`);
  };

  const formatPeriodDisplay = (periodStr: string) => {
    const [year, month] = periodStr.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const handleQuickTap = async () => {
    setIsRecording(true);
    try {
      await recordQuickDelivery();
    } finally {
      setIsRecording(false);
    }
  };

  const handleDelete = (delivery: WaterDeliveryItem) => {
    Alert.alert(
      'Remove Delivery?',
      `Delete water delivery on ${delivery.deliveryDate} at ${formatTime(delivery.deliveryTime)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteDelivery(delivery.id),
        },
      ]
    );
  };

  // Group deliveries by deliveryDate
  const groupedDeliveries = React.useMemo(() => {
    const map = new Map<string, WaterDeliveryItem[]>();
    for (const d of waterDeliveries) {
      const list = map.get(d.deliveryDate) || [];
      list.push(d);
      map.set(d.deliveryDate, list);
    }

    const sortedDates = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));
    return sortedDates.map((date) => {
      const items = map.get(date) || [];
      items.sort((a, b) => b.deliveryTime.localeCompare(a.deliveryTime));
      const dayTotalPaise = items.reduce((sum, item) => sum + item.pricePaise, 0);
      return { date, items, dayTotalPaise };
    });
  }, [waterDeliveries]);

  // Total deliveries & cost for the month
  const totalDeliveries = waterDeliveries.length;
  const totalAmountPaise = waterDeliveries.reduce((sum, item) => sum + item.pricePaise, 0);
  const memberCount = Math.max(activeMembers.length, 1);
  const perMemberSharePaise = Math.round(totalAmountPaise / memberCount);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <View style={styles.headerLeft}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color={colors.ink} />
          </Pressable>
          <View>
            <Text style={styles.headerTitle}>Water Deliveries</Text>
            <Text style={styles.headerSubtitle}>
              {room?.name || 'Flat 302'} • {formatPeriodDisplay(selectedPeriod)}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            style={styles.headerPillBtn}
            onPress={() => router.push('/backdate-water')}
          >
            <Feather name="calendar" size={13} color={colors.primary} />
            <Text style={styles.headerPillText}>Backdate</Text>
          </Pressable>

          {isAdmin && (
            <Pressable
              style={styles.headerPillBtn}
              onPress={() => router.push('/service-config')}
            >
              <Feather name="settings" size={13} color={colors.ink} />
              <Text style={[styles.headerPillText, { color: colors.ink }]}>Pricing</Text>
            </Pressable>
          )}
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

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Undo Toast Banner */}
        {undoSecondsLeft > 0 && lastAddedDelivery && (
          <View style={styles.undoToast}>
            <View style={styles.undoTextCol}>
              <Feather name="check-circle" size={16} color={colors.success} />
              <Text style={styles.undoText}>
                Water delivery recorded at {formatTime(lastAddedDelivery.deliveryTime)} (
                {formatPaise(lastAddedDelivery.pricePaise)})
              </Text>
            </View>
            <Pressable style={styles.undoBtn} onPress={undoLastDelivery}>
              <Text style={styles.undoBtnText}>Undo ({undoSecondsLeft}s)</Text>
            </Pressable>
          </View>
        )}

        {/* Quick Tap Hero Card */}
        <Card style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.dropletIconBox}>
              <Feather name="droplet" size={26} color={colors.primary} />
            </View>
            <View style={styles.heroInfo}>
              <Text style={styles.heroTag}>1-TOUCH WATER LOG</Text>
              <Text style={styles.heroTitle}>Delivery Arrived Today?</Text>
              <Text style={styles.heroPriceText}>
                Current Rate: {formatPaise(serviceConfig.waterPricePaise)} per 20L delivery
              </Text>
            </View>
          </View>

          <Pressable
            style={[styles.quickTapBtn, isRecording && styles.btnDisabled]}
            onPress={handleQuickTap}
            disabled={isRecording}
          >
            <Feather name="plus-circle" size={18} color="#FFFFFF" />
            <Text style={styles.quickTapBtnText}>
              {isRecording ? 'Logging...' : 'Tap to Record Delivery Now'}
            </Text>
          </Pressable>

          <Text style={styles.heroSubtext}>
            Any roommate can tap to log. Multiple deliveries on the same day are supported.
          </Text>
        </Card>

        {/* Monthly Summary Statistics */}
        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>TOTAL DELIVERIES</Text>
            <Text style={styles.statNumber}>{totalDeliveries}</Text>
            <Text style={styles.statSub}>Jugs delivered</Text>
          </Card>

          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>MONTH TOTAL</Text>
            <Text style={[styles.statNumber, { color: colors.primary, fontVariant: ['tabular-nums'] }]}>
              {formatPaise(totalAmountPaise)}
            </Text>
            <Text style={styles.statSub}>~{formatPaise(perMemberSharePaise)} / roommate</Text>
          </Card>
        </View>

        {/* Deliveries List Grouped by Date */}
        <View style={styles.listSection}>
          <Text style={styles.sectionHeader}>Delivery History ({totalDeliveries})</Text>

          {groupedDeliveries.length === 0 ? (
            <EmptyState
              icon="droplet"
              title="No Deliveries Logged"
              description={`No water deliveries recorded for ${formatPeriodDisplay(selectedPeriod)} yet. Tap above to log.`}
            />
          ) : (
            groupedDeliveries.map((group) => (
              <View key={group.date} style={styles.groupContainer}>
                {/* Date Group Header */}
                <View style={styles.dateHeaderRow}>
                  <Text style={styles.dateHeaderText}>{formatDateHeader(group.date)}</Text>
                  <Text style={styles.dateHeaderTotal}>
                    {group.items.length} {group.items.length > 1 ? 'deliveries' : 'delivery'} •{' '}
                    {formatPaise(group.dayTotalPaise)}
                  </Text>
                </View>

                {/* Day Items Card */}
                <Card style={styles.groupCard}>
                  {group.items.map((item, idx) => (
                    <View
                      key={item.id}
                      style={[styles.deliveryRow, idx > 0 && styles.deliveryBorder]}
                    >
                      <View style={styles.timeIconBox}>
                        <Feather name="clock" size={14} color={colors.primary} />
                      </View>

                      <View style={styles.deliveryDetails}>
                        <View style={styles.timeRow}>
                          <Text style={styles.deliveryTime}>{formatTime(item.deliveryTime)}</Text>
                          <Text style={[styles.deliveryPrice, { fontVariant: ['tabular-nums'] }]}>
                            {formatPaise(item.pricePaise)}
                          </Text>
                        </View>
                        <Text style={styles.recordedByText}>Logged by {item.recordedByName}</Text>
                      </View>

                      <Pressable
                        style={styles.deleteBtn}
                        onPress={() => handleDelete(item)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Feather name="trash-2" size={14} color={colors.inkTertiary} />
                      </Pressable>
                    </View>
                  ))}
                </Card>
              </View>
            ))
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
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: space.sm },
  backBtn: { padding: space.xs, marginRight: space.xs },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.ink },
  headerSubtitle: { fontSize: 11, color: colors.inkSecondary, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm + 2,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    gap: 4,
  },
  headerPillText: { fontSize: 11, fontWeight: '700', color: colors.primary },

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

  container: { padding: space.lg, paddingBottom: 60 },

  undoToast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.success,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    borderRadius: radius.md,
    marginBottom: space.md,
  },
  undoTextCol: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flex: 1 },
  undoText: { fontSize: 12, fontWeight: '600', color: colors.ink, flex: 1 },
  undoBtn: {
    backgroundColor: colors.surface,
    paddingHorizontal: space.sm + 4,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.success,
  },
  undoBtnText: { fontSize: 11, fontWeight: '700', color: colors.success },

  heroCard: { padding: space.lg, marginBottom: space.md },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: space.md },
  dropletIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },
  heroInfo: { flex: 1 },
  heroTag: { fontSize: 10, fontWeight: '800', color: colors.primary, letterSpacing: 0.5 },
  heroTitle: { fontSize: 17, fontWeight: '800', color: colors.ink, marginTop: 2 },
  heroPriceText: { fontSize: 12, color: colors.inkSecondary, marginTop: 2 },

  quickTapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: space.md,
    borderRadius: radius.md,
    gap: space.xs,
  },
  quickTapBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
  heroSubtext: { fontSize: 11, color: colors.inkSecondary, textAlign: 'center', marginTop: space.sm },

  statsRow: { flexDirection: 'row', gap: space.sm, marginBottom: space.lg },
  statCard: { flex: 1, padding: space.md },
  statLabel: { fontSize: 10, fontWeight: '700', color: colors.inkSecondary, letterSpacing: 0.5 },
  statNumber: { fontSize: 24, fontWeight: '800', color: colors.ink, marginVertical: 4 },
  statSub: { fontSize: 11, color: colors.inkSecondary },

  listSection: { gap: space.md },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.inkSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  groupContainer: { marginBottom: space.xs },
  dateHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  dateHeaderText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  dateHeaderTotal: { fontSize: 11, color: colors.inkSecondary, fontWeight: '600' },

  groupCard: { padding: 0, overflow: 'hidden' },
  deliveryRow: { flexDirection: 'row', alignItems: 'center', padding: space.md },
  deliveryBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  timeIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.sm,
  },
  deliveryDetails: { flex: 1 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deliveryTime: { fontSize: 14, fontWeight: '700', color: colors.ink },
  deliveryPrice: { fontSize: 14, fontWeight: '800', color: colors.ink },
  recordedByText: { fontSize: 11, color: colors.inkSecondary, marginTop: 2 },
  deleteBtn: { padding: space.xs, marginLeft: space.sm },
});
