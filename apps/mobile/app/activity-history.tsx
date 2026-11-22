import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  StatusBar as RNStatusBar,
  ActivityIndicator,
  RefreshControl,
  SectionList,
  Modal,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useActivity, ActivityItem, ActivityFilter } from '../context/ActivityContext';
import { useRoom } from '../context/RoomContext';
import { colors, space, radius, type } from '../lib/tokens';
import { formatPaise } from '../lib/utils';
import { EmptyState } from '../components/ui/EmptyState';

function formatTimeAgo(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffSecs = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSecs < 60) return 'Just now';
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatExactIST(isoString: string): string {
  const date = new Date(isoString);
  return (
    date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }) + ' IST'
  );
}

function getDateGroup(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();

  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 7) return 'This Week';
  if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) {
    return 'Earlier This Month';
  }
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function getEntityConfig(entityType: ActivityItem['entityType'], action: string) {
  if (action === 'expense_deleted' || action === 'payment_cancelled' || action === 'payment_reversed') {
    return {
      icon: (action === 'expense_deleted' ? 'trash-2' : 'alert-circle') as keyof typeof Feather.glyphMap,
      color: colors.danger,
      bgColor: colors.dangerSoft,
      label: action.replace(/_/g, ' '),
    };
  }

  switch (entityType) {
    case 'expense':
      return {
        icon: 'file-text' as keyof typeof Feather.glyphMap,
        color: '#7C3AED',
        bgColor: '#F5F3FF',
        label: 'Expense',
      };
    case 'payment':
      return {
        icon: 'check-circle' as keyof typeof Feather.glyphMap,
        color: colors.success,
        bgColor: colors.successSoft,
        label: 'Payment',
      };
    case 'settlement':
      return {
        icon: 'pie-chart' as keyof typeof Feather.glyphMap,
        color: colors.warning,
        bgColor: colors.warningSoft,
        label: 'Settlement',
      };
    case 'water':
      return {
        icon: 'droplet' as keyof typeof Feather.glyphMap,
        color: '#0284C7',
        bgColor: '#E0F2FE',
        label: 'Water',
      };
    case 'member':
      return {
        icon: 'users' as keyof typeof Feather.glyphMap,
        color: '#DB2777',
        bgColor: '#FCE7F3',
        label: 'Member',
      };
    case 'room':
    default:
      return {
        icon: 'home' as keyof typeof Feather.glyphMap,
        color: colors.primary,
        bgColor: colors.primarySoft,
        label: 'Room',
      };
  }
}

export default function ActivityHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset =
    Math.max(insets.top, Platform.OS === 'android' ? RNStatusBar.currentHeight || 28 : 0, 24) + 8;

  const { room } = useRoom();
  const {
    activities,
    filter,
    filterCounts,
    isLoading,
    isLoadingMore,
    isRefreshing,
    hasMore,
    selectedActivity,
    setFilter,
    setSelectedActivity,
    loadMore,
    refreshActivities,
  } = useActivity();

  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // Filter chips definitions
  const filterChips: { id: ActivityFilter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: filterCounts.all },
    { id: 'expenses', label: 'Expenses', count: filterCounts.expenses },
    { id: 'payments', label: 'Payments', count: filterCounts.payments },
    { id: 'settlements', label: 'Settlements', count: filterCounts.settlements },
    { id: 'water', label: 'Water', count: filterCounts.water },
    { id: 'room', label: 'Room & Members', count: filterCounts.room },
  ];

  // Group activities by date
  const sections = useMemo(() => {
    const groups: Record<string, ActivityItem[]> = {};

    activities.forEach((item) => {
      const groupKey = getDateGroup(item.createdAt);
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
    });

    return Object.keys(groups).map((groupTitle) => ({
      title: groupTitle,
      data: groups[groupTitle],
    }));
  }, [activities]);

  const handleOpenDetail = (item: ActivityItem) => {
    setSelectedActivity(item);
    setDetailModalVisible(true);
  };

  const handleNavigateDeepLink = (link?: string) => {
    if (!link) return;
    setDetailModalVisible(false);
    setTimeout(() => {
      router.push(link as any);
    }, 200);
  };

  return (
    <View style={styles.safeArea}>
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: topInset }]}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Feather name="arrow-left" size={20} color={colors.ink} />
        </Pressable>
        <View style={styles.headerTitleCol}>
          <Text style={styles.headerTitle}>Activity History</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {room?.name || 'Flat 302, Green Glen'} · Audit Log
          </Text>
        </View>
        <View style={{ width: 28 }} />
      </View>

      {/* Filter Chips Horizontal Bar */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {filterChips.map((chip) => {
            const isActive = filter === chip.id;
            return (
              <Pressable
                key={chip.id}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setFilter(chip.id)}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {chip.label}
                </Text>
                <View
                  style={[styles.counterBadge, isActive && styles.counterBadgeActive]}
                >
                  <Text
                    style={[styles.counterBadgeText, isActive && styles.counterBadgeTextActive]}
                  >
                    {chip.count}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Activity Timeline List */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, activities.length === 0 && styles.listEmpty]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refreshActivities}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{title}</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const config = getEntityConfig(item.entityType, item.action);
          const isEdit = item.action === 'expense_updated';
          const prevAmt = item.details?.previousValues?.amountPaise;
          const newAmt = item.details?.updatedValues?.amountPaise;

          return (
            <Pressable
              style={({ pressed }) => [styles.activityCard, pressed && styles.cardPressed]}
              onPress={() => handleOpenDetail(item)}
            >
              {/* Entity Icon Badge */}
              <View style={[styles.entityIconBox, { backgroundColor: config.bgColor }]}>
                <Feather name={config.icon} size={18} color={config.color} />
              </View>

              {/* Activity Info */}
              <View style={styles.activityInfo}>
                <View style={styles.activityTopRow}>
                  <View style={styles.actorRow}>
                    <Text style={styles.actorName} numberOfLines={1}>
                      {item.userName}
                    </Text>
                    <View style={styles.roleTag}>
                      <Text style={styles.roleTagText}>{config.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.timeAgo}>{formatTimeAgo(item.createdAt)}</Text>
                </View>

                <Text style={styles.activityTitle} numberOfLines={2}>
                  {item.title}
                </Text>

                <Text style={styles.activityDesc} numberOfLines={2}>
                  {item.description}
                </Text>

                {/* Edit Value Pill */}
                {isEdit && prevAmt !== undefined && newAmt !== undefined && (
                  <View style={styles.diffPill}>
                    <Feather name="repeat" size={11} color={colors.primary} />
                    <Text style={styles.diffPillText}>
                      Amount: {formatPaise(prevAmt)} ➔ {formatPaise(newAmt)}
                    </Text>
                  </View>
                )}
              </View>

              <Feather name="chevron-right" size={15} color={colors.inkTertiary} />
            </Pressable>
          );
        }}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="activity"
              title="No Activity Found"
              description={`No logged records match the selected filter "${filter}".`}
              actionTitle="Show All Activity"
              onActionPress={() => setFilter('all')}
            />
          ) : (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>Loading activity history...</Text>
            </View>
          )
        }
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : hasMore ? (
            <Pressable style={styles.loadMoreBtn} onPress={loadMore}>
              <Text style={styles.loadMoreText}>Load More</Text>
            </Pressable>
          ) : activities.length > 0 ? (
            <Text style={styles.endOfAuditText}>• End of recorded audit history •</Text>
          ) : undefined
        }
      />

      {/* Activity Detail Modal */}
      <Modal
        visible={detailModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setDetailModalVisible(false)}
        >
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            {selectedActivity && (
              <>
                {/* Modal Handle */}
                <View style={styles.modalHandle} />

                {/* Modal Header */}
                <View style={styles.modalHeaderRow}>
                  <View style={styles.modalHeaderLeft}>
                    {(() => {
                      const config = getEntityConfig(
                        selectedActivity.entityType,
                        selectedActivity.action
                      );
                      return (
                        <View style={[styles.modalIconBox, { backgroundColor: config.bgColor }]}>
                          <Feather name={config.icon} size={20} color={config.color} />
                        </View>
                      );
                    })()}
                    <View style={styles.modalTitleCol}>
                      <Text style={styles.modalActionTag}>
                        {selectedActivity.action.replace(/_/g, ' ').toUpperCase()}
                      </Text>
                      <Text style={styles.modalTitle} numberOfLines={2}>
                        {selectedActivity.title}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    style={styles.modalCloseBtn}
                    onPress={() => setDetailModalVisible(false)}
                  >
                    <Feather name="x" size={18} color={colors.ink} />
                  </Pressable>
                </View>

                {/* Modal Body */}
                <ScrollView showsVerticalScrollIndicator={false} style={styles.modalBody}>
                  {/* Actor & Timestamp Card */}
                  <View style={styles.detailSectionCard}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Performed By</Text>
                      <View style={styles.detailValueRow}>
                        <View style={styles.actorAvatar}>
                          <Text style={styles.actorAvatarText}>
                            {selectedActivity.userName[0] || 'U'}
                          </Text>
                        </View>
                        <View>
                          <Text style={styles.detailValueBold}>{selectedActivity.userName}</Text>
                          {selectedActivity.userEmail ? (
                            <Text style={styles.detailSubtext}>{selectedActivity.userEmail}</Text>
                          ) : null}
                        </View>
                      </View>
                    </View>

                    <View style={styles.detailDivider} />

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Timestamp</Text>
                      <View style={styles.detailValueCol}>
                        <Text style={styles.detailValueBold}>
                          {formatExactIST(selectedActivity.createdAt)}
                        </Text>
                        <Text style={styles.detailSubtext}>
                          {formatTimeAgo(selectedActivity.createdAt)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Metadata Breakdowns */}
                  <View style={styles.detailSectionCard}>
                    <Text style={styles.sectionCardTitle}>Event Metadata</Text>

                    {/* Before vs After if update */}
                    {selectedActivity.details?.previousValues && selectedActivity.details?.updatedValues && (
                      <View style={styles.diffTable}>
                        <Text style={styles.diffTableTitle}>Change Summary</Text>
                        <View style={styles.diffRow}>
                          <Text style={styles.diffColHeader}>Previous</Text>
                          <Text style={styles.diffColHeader}>Updated</Text>
                        </View>
                        <View style={styles.diffRow}>
                          <Text style={styles.diffValPrev}>
                            {selectedActivity.details.previousValues.name || '—'}
                            {selectedActivity.details.previousValues.amountPaise !== undefined
                              ? ` (${formatPaise(selectedActivity.details.previousValues.amountPaise)})`
                              : ''}
                          </Text>
                          <Text style={styles.diffValNew}>
                            {selectedActivity.details.updatedValues.name || '—'}
                            {selectedActivity.details.updatedValues.amountPaise !== undefined
                              ? ` (${formatPaise(selectedActivity.details.updatedValues.amountPaise)})`
                              : ''}
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Key Details Rows */}
                    {Object.entries(selectedActivity.details || {})
                      .filter(
                        ([k]) =>
                          k !== 'previousValues' &&
                          k !== 'updatedValues' &&
                          k !== 'expenseId' &&
                          k !== 'paymentId' &&
                          k !== 'settlementId' &&
                          k !== 'deliveryId'
                      )
                      .map(([key, val]) => {
                        const formattedKey = key
                          .replace(/([A-Z])/g, ' $1')
                          .replace(/_/g, ' ')
                          .replace(/^\w/, (c) => c.toUpperCase());

                        const displayVal =
                          typeof val === 'number' && key.toLowerCase().includes('paise')
                            ? formatPaise(val)
                            : typeof val === 'object'
                            ? JSON.stringify(val)
                            : String(val);

                        return (
                          <View key={key} style={styles.metaRow}>
                            <Text style={styles.metaKey}>{formattedKey}</Text>
                            <Text style={styles.metaVal}>{displayVal}</Text>
                          </View>
                        );
                      })}
                  </View>

                  {/* Description Box */}
                  <View style={styles.descBox}>
                    <Feather name="info" size={14} color={colors.primary} />
                    <Text style={styles.descText}>{selectedActivity.description}</Text>
                  </View>
                </ScrollView>

                {/* Footer Action */}
                {selectedActivity.deepLink && (
                  <View style={styles.modalFooter}>
                    <Pressable
                      style={styles.deepLinkBtn}
                      onPress={() => handleNavigateDeepLink(selectedActivity.deepLink)}
                    >
                      <Text style={styles.deepLinkBtnText}>View Related Record</Text>
                      <Feather name="arrow-right" size={16} color="#FFFFFF" />
                    </Pressable>
                  </View>
                )}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: space.xs,
  },
  headerTitleCol: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    ...type.title,
    color: colors.ink,
  },
  headerSub: {
    ...type.caption,
    color: colors.inkSecondary,
    marginTop: 2,
  },
  filterBar: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: space.sm,
  },
  filterScroll: {
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    gap: space.xs + 2,
  },
  filterChipActive: {
    backgroundColor: colors.ink,
  },
  filterChipText: {
    ...type.caption,
    fontWeight: '600',
    color: colors.inkSecondary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  counterBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    backgroundColor: colors.border,
  },
  counterBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  counterBadgeText: {
    ...type.caption,
    fontSize: 10,
    fontWeight: '700',
    color: colors.ink,
  },
  counterBadgeTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: space.lg,
    paddingBottom: space.xxl + 20,
    gap: space.sm,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  sectionHeader: {
    paddingVertical: space.xs + 2,
    marginTop: space.sm,
    marginBottom: space.xs,
  },
  sectionHeaderText: {
    ...type.caption,
    fontWeight: '700',
    color: colors.inkTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: space.md,
  },
  cardPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  entityIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityInfo: {
    flex: 1,
    gap: 2,
  },
  activityTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    flex: 1,
  },
  actorName: {
    ...type.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  roleTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  roleTagText: {
    ...type.caption,
    fontSize: 10,
    color: colors.inkSecondary,
    fontWeight: '500',
  },
  timeAgo: {
    ...type.caption,
    fontSize: 11,
    color: colors.inkTertiary,
  },
  activityTitle: {
    ...type.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  activityDesc: {
    ...type.caption,
    color: colors.inkSecondary,
    fontSize: 12,
  },
  diffPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  diffPillText: {
    ...type.caption,
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
  },
  loadingBox: {
    padding: space.xxl,
    alignItems: 'center',
    gap: space.sm,
  },
  loadingText: {
    ...type.caption,
    color: colors.inkSecondary,
  },
  footerLoader: {
    paddingVertical: space.md,
    alignItems: 'center',
  },
  loadMoreBtn: {
    alignSelf: 'center',
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    marginTop: space.sm,
  },
  loadMoreText: {
    ...type.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  endOfAuditText: {
    ...type.caption,
    textAlign: 'center',
    color: colors.inkTertiary,
    marginTop: space.md,
    fontSize: 11,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg + 4,
    borderTopRightRadius: radius.lg + 4,
    maxHeight: '85%',
    paddingBottom: space.xl,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: space.sm,
    marginBottom: space.sm,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    flex: 1,
  },
  modalIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitleCol: {
    flex: 1,
    gap: 2,
  },
  modalActionTag: {
    ...type.caption,
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkTertiary,
    letterSpacing: 0.5,
  },
  modalTitle: {
    ...type.title,
    fontSize: 16,
    color: colors.ink,
  },
  modalCloseBtn: {
    padding: space.xs,
  },
  modalBody: {
    padding: space.lg,
  },
  detailSectionCard: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: space.md,
  },
  sectionCardTitle: {
    ...type.caption,
    fontWeight: '700',
    color: colors.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: space.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailLabel: {
    ...type.caption,
    color: colors.inkSecondary,
  },
  detailValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  detailValueCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  actorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actorAvatarText: {
    ...type.caption,
    fontWeight: '700',
    color: colors.primary,
  },
  detailValueBold: {
    ...type.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  detailSubtext: {
    ...type.caption,
    fontSize: 11,
    color: colors.inkTertiary,
  },
  detailDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: space.sm,
  },
  diffTable: {
    backgroundColor: colors.surface,
    padding: space.sm,
    borderRadius: radius.sm,
    marginBottom: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  diffTableTitle: {
    ...type.caption,
    fontSize: 11,
    fontWeight: '600',
    color: colors.inkSecondary,
    marginBottom: 4,
  },
  diffRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  diffColHeader: {
    ...type.caption,
    fontSize: 10,
    color: colors.inkTertiary,
    fontWeight: '600',
    flex: 1,
  },
  diffValPrev: {
    ...type.caption,
    fontSize: 12,
    color: colors.danger,
    flex: 1,
    textDecorationLine: 'line-through',
  },
  diffValNew: {
    ...type.caption,
    fontSize: 12,
    color: colors.success,
    fontWeight: '600',
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  metaKey: {
    ...type.caption,
    color: colors.inkSecondary,
  },
  metaVal: {
    ...type.body,
    fontSize: 13,
    fontWeight: '500',
    color: colors.ink,
  },
  descBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primarySoft,
    padding: space.sm + 2,
    borderRadius: radius.md,
    gap: space.xs + 2,
    marginBottom: space.md,
  },
  descText: {
    ...type.caption,
    fontSize: 12,
    lineHeight: 16,
    color: colors.primary,
    flex: 1,
  },
  modalFooter: {
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
  },
  deepLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: space.md,
    borderRadius: radius.md,
    gap: space.sm,
  },
  deepLinkBtnText: {
    ...type.label,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
