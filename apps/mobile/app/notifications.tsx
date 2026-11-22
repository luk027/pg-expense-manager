import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  SafeAreaView,
  Platform,
  StatusBar as RNStatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, space, radius } from '../lib/tokens';
import { useNotifications, NotificationItem, NotificationEventType } from '../context/NotificationContext';
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

function getEventConfig(eventType: NotificationEventType): {
  icon: keyof typeof Feather.glyphMap;
  color: string;
  bgColor: string;
} {
  switch (eventType) {
    case 'expense_created':
      return { icon: 'plus-circle', color: colors.primary, bgColor: colors.primarySoft };
    case 'expense_updated':
      return { icon: 'edit-2', color: '#0284C7', bgColor: '#E0F2FE' };
    case 'expense_deleted':
      return { icon: 'trash-2', color: colors.danger, bgColor: colors.dangerSoft };
    case 'settlement_finalized':
      return { icon: 'lock', color: '#7C3AED', bgColor: '#EDE9FE' };
    case 'payment_sent':
      return { icon: 'clock', color: colors.warning, bgColor: colors.warningSoft };
    case 'payment_confirmed':
      return { icon: 'check-circle', color: colors.success, bgColor: colors.successSoft };
    case 'payment_reversed':
      return { icon: 'alert-triangle', color: colors.danger, bgColor: colors.dangerSoft };
    case 'water_delivery_logged':
      return { icon: 'droplet', color: '#0284C7', bgColor: '#E0F2FE' };
    default:
      return { icon: 'bell', color: colors.inkSecondary, bgColor: colors.surfaceMuted };
  }
}

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    notifications,
    unreadCount,
    isNotificationsEnabled,
    markAsRead,
    markAllAsRead,
    sendTestNotification,
  } = useNotifications();

  const [testingType, setTestingType] = useState<string | null>(null);
  const [showTestPanel, setShowTestPanel] = useState(false);

  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (RNStatusBar.currentHeight || 28) : 0,
    24
  );

  const handleNotificationPress = (notif: NotificationItem) => {
    markAsRead(notif.id);
    if (notif.data?.url) {
      router.push(notif.data.url as any);
    }
  };

  const handleSendTest = async (eventType: NotificationEventType) => {
    setTestingType(eventType);
    const res = await sendTestNotification(eventType);
    setTestingType(null);
    if (!res.success && res.error) {
      Alert.alert('Notifications Stopped', res.error, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Room Settings', onPress: () => router.push('/room-settings') },
      ]);
    }
  };

  const testEventList: Array<{ type: NotificationEventType; label: string }> = [
    { type: 'expense_created', label: '+ Expense' },
    { type: 'expense_updated', label: 'Edit Exp' },
    { type: 'expense_deleted', label: 'Delete Exp' },
    { type: 'settlement_finalized', label: 'Settlement' },
    { type: 'payment_sent', label: 'Pay Sent' },
    { type: 'payment_confirmed', label: 'Confirmed' },
    { type: 'payment_reversed', label: 'Reversed' },
    { type: 'water_delivery_logged', label: 'Water 💧' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header with status bar clearance */}
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadPill}>
              <Text style={styles.unreadPillText}>{unreadCount} new</Text>
            </View>
          )}
        </View>

        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <Pressable onPress={markAllAsRead} style={styles.markReadBtn}>
              <Text style={styles.markReadBtnText}>Mark all read</Text>
            </Pressable>
          )}
          <Pressable onPress={() => router.back()} style={styles.closeBtn}>
            <Feather name="x" size={20} color={colors.ink} />
          </Pressable>
        </View>
      </View>

      {/* Notifications Stopped Banner */}
      {!isNotificationsEnabled && (
        <View style={styles.suppressedBanner}>
          <Feather name="bell-off" size={18} color={colors.danger} />
          <View style={styles.suppressedInfo}>
            <Text style={styles.suppressedTitle}>Notifications Are Stopped</Text>
            <Text style={styles.suppressedSub}>
              Room activity alerts are disabled in Room Settings. Turn them on to receive notifications.
            </Text>
          </View>
          <Pressable
            style={styles.suppressedActionBtn}
            onPress={() => router.push('/room-settings')}
          >
            <Text style={styles.suppressedActionText}>Settings</Text>
          </Pressable>
        </View>
      )}

      {/* Quick Test Toolbar Toggle */}
      <View style={styles.testToolbar}>
        <Pressable
          style={styles.testToggleBtn}
          onPress={() => setShowTestPanel((prev) => !prev)}
        >
          <Feather name="send" size={13} color={colors.primary} />
          <Text style={styles.testToggleText}>
            {showTestPanel ? 'Hide Test Triggers' : 'Test Push Notification Events (7 Types)'}
          </Text>
          <Feather
            name={showTestPanel ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={colors.primary}
          />
        </Pressable>

        {showTestPanel && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.testChipsRow}
          >
            {testEventList.map((item) => (
              <Pressable
                key={item.type}
                style={[
                  styles.testChip,
                  testingType === item.type && styles.testChipActive,
                ]}
                disabled={testingType !== null}
                onPress={() => handleSendTest(item.type)}
              >
                {testingType === item.type ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.testChipText}>{item.label}</Text>
                )}
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Notifications List */}
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {notifications.length === 0 ? (
          <EmptyState
            title="No Notifications Yet"
            description="You'll be notified when roommates add expenses, log water cans, or finalize settlements."
          />
        ) : (
          <View style={styles.listCard}>
            {notifications.map((notif, idx) => {
              const config = getEventConfig(notif.eventType);
              const isUnread = !notif.read;

              return (
                <Pressable
                  key={notif.id || idx}
                  style={({ pressed }) => [
                    styles.notifRow,
                    idx > 0 && styles.notifBorder,
                    isUnread && styles.notifRowUnread,
                    pressed && styles.notifRowPressed,
                  ]}
                  onPress={() => handleNotificationPress(notif)}
                >
                  <View style={[styles.iconWrapper, { backgroundColor: config.bgColor }]}>
                    <Feather name={config.icon} size={18} color={config.color} />
                  </View>

                  <View style={styles.notifContent}>
                    <View style={styles.titleRow}>
                      <Text
                        style={[styles.notifTitle, isUnread && styles.notifTitleUnread]}
                        numberOfLines={1}
                      >
                        {notif.title}
                      </Text>
                      <Text style={styles.timeAgo}>{formatTimeAgo(notif.createdAt)}</Text>
                    </View>
                    <Text style={styles.notifBody} numberOfLines={2}>
                      {notif.body}
                    </Text>
                  </View>

                  {isUnread && <View style={styles.unreadDot} />}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink,
  },
  unreadPill: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  unreadPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  markReadBtn: {
    paddingVertical: 4,
  },
  markReadBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  closeBtn: {
    padding: space.xs,
  },
  suppressedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderColor: '#FECACA',
    borderWidth: 1,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    gap: space.sm,
  },
  suppressedInfo: {
    flex: 1,
  },
  suppressedTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.danger,
  },
  suppressedSub: {
    fontSize: 11,
    color: '#991B1B',
    marginTop: 1,
  },
  suppressedActionBtn: {
    backgroundColor: colors.surface,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderColor: '#FECACA',
    borderWidth: 1,
  },
  suppressedActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.danger,
  },
  testToolbar: {
    backgroundColor: '#EFF6FF',
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  testToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  testToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    flex: 1,
  },
  testChipsRow: {
    flexDirection: 'row',
    gap: space.xs,
    paddingTop: space.sm,
    paddingBottom: 2,
  },
  testChip: {
    backgroundColor: colors.surface,
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm + 2,
    paddingVertical: 4,
  },
  testChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  testChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  container: {
    padding: space.lg,
    paddingBottom: space.xxl,
  },
  listCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderColor: colors.border,
    borderWidth: 1,
    overflow: 'hidden',
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
    gap: space.md,
  },
  notifRowUnread: {
    backgroundColor: '#F8FAFC',
  },
  notifRowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  notifBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
    flex: 1,
    marginRight: space.xs,
  },
  notifTitleUnread: {
    fontWeight: '700',
    color: colors.ink,
  },
  timeAgo: {
    fontSize: 10,
    color: colors.inkTertiary,
  },
  notifBody: {
    fontSize: 12,
    color: colors.inkSecondary,
    lineHeight: 16,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
});
