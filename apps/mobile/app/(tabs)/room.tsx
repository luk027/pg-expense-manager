import React from 'react';
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
import { Card, Button, Avatar } from '../../components/ui';
import { colors, space, radius } from '../../lib/tokens';
import { useAuth } from '../../context/AuthContext';
import { useRoom } from '../../context/RoomContext';
import { formatPaise } from '../../lib/utils';

export default function RoomScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const {
    room,
    hasRoom,
    activeMembers,
    pendingMembers,
    isAdmin,
    approveMember,
    removeMember,
  } = useRoom();

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of PG Expense Manager?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => logout(),
      },
    ]);
  };

  const handleApprove = async (memberId: string, memberName: string) => {
    const res = await approveMember(memberId);
    if (res.success) {
      Alert.alert('Approved', `${memberName} has been approved as an active roommate.`);
    } else {
      Alert.alert('Error', res.error || 'Failed to approve member');
    }
  };

  const handleRemove = (memberId: string, memberName: string) => {
    Alert.alert(
      'Remove Roommate',
      `Remove ${memberName} from this room? Historical expenses and payment records will be preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const res = await removeMember(memberId);
            if (res.success) {
              Alert.alert('Removed', `${memberName} was marked as departed.`);
            } else {
              Alert.alert('Error', res.error || 'Failed to remove member');
            }
          },
        },
      ]
    );
  };

  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (RNStatusBar.currentHeight || 28) : 0,
    24
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: topInset + 8 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* User Session Bar */}
        <View style={styles.userCard}>
          <Avatar name={user?.name || 'User'} size="sm" />
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name || 'Logged In User'}</Text>
            <Text style={styles.userEmail}>{user?.email || 'user@example.com'}</Text>
          </View>
          <Pressable style={styles.logoutBtn} onPress={handleLogout}>
            <Feather name="log-out" size={14} color={colors.danger} />
            <Text style={styles.logoutBtnText}>Sign Out</Text>
          </Pressable>
        </View>

        {!hasRoom ? (
          /* Onboarding state when user has no active room */
          <Card style={styles.noRoomCard}>
            <View style={styles.noRoomIcon}>
              <Feather name="home" size={32} color={colors.primary} />
            </View>
            <Text style={styles.noRoomTitle}>You don't have a room yet</Text>
            <Text style={styles.noRoomDesc}>
              Create a shared room for your flat, or join an existing one using an invite code.
            </Text>
            <View style={styles.noRoomActions}>
              <Button
                title="Create Room"
                onPress={() => router.push('/create-room')}
                icon={<Feather name="plus" size={16} color="#FFFFFF" />}
              />
              <Button
                title="Join Existing Room"
                variant="outline"
                onPress={() => router.push('/join-room')}
                icon={<Feather name="key" size={16} color={colors.ink} />}
              />
            </View>
          </Card>
        ) : (
          <>
            {/* Room Header Card */}
            <View style={styles.roomHeader}>
              <View style={styles.roomAvatar}>
                <Feather name="home" size={24} color={colors.primary} />
              </View>
              <View style={styles.roomHeaderInfo}>
                <Text style={styles.roomName}>{room?.name || 'Shared Flat'}</Text>
                <Text style={styles.roomSub}>
                  {activeMembers.length} Roommates • Rent: {room ? formatPaise(room.monthlyRentPaise) : '₹0'}
                </Text>
              </View>
            </View>

            {/* Pending Requests Banner (Admin Only) */}
            {isAdmin && pendingMembers.length > 0 && (
              <View style={styles.pendingSection}>
                <View style={styles.pendingHeaderRow}>
                  <Text style={styles.pendingTitle}>Join Requests ({pendingMembers.length})</Text>
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>Pending Approval</Text>
                  </View>
                </View>
                <Card style={styles.pendingCard}>
                  {pendingMembers.map((pm, idx) => (
                    <View key={pm.id} style={[styles.pendingRow, idx > 0 && styles.rowBorder]}>
                      <Avatar name={pm.name} size="sm" />
                      <View style={{ flex: 1, marginLeft: space.sm }}>
                        <Text style={styles.memberName}>{pm.name}</Text>
                        <Text style={styles.memberEmail}>{pm.email}</Text>
                      </View>
                      <Button
                        title="Approve"
                        size="sm"
                        onPress={() => handleApprove(pm.id, pm.name)}
                        icon={<Feather name="check" size={14} color="#FFFFFF" />}
                      />
                    </View>
                  ))}
                </Card>
              </View>
            )}

            {/* Roommates List */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Active Roommates</Text>
              {isAdmin && (
                <Pressable style={styles.inviteBtn} onPress={() => router.push('/invite-modal')}>
                  <Feather name="user-plus" size={14} color={colors.primary} />
                  <Text style={styles.inviteBtnText}>Invite</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.cardList}>
              {activeMembers.map((member, idx) => {
                const isMemberAdmin = room?.adminId === member.userId;
                const isMemberCollector = room?.collectorId === member.userId;
                const isYou = user?.id === member.userId || user?.email === member.email;

                return (
                  <View key={member.id} style={[styles.memberRow, idx > 0 && styles.rowBorder]}>
                    <Avatar name={member.name} size="md" />
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>
                        {member.name} {isYou && <Text style={styles.youTag}>(You)</Text>}
                      </Text>
                      <View style={styles.roleBadgesRow}>
                        {isMemberAdmin && isMemberCollector ? (
                          <View style={styles.adminBadge}>
                            <Feather name="shield" size={11} color={colors.primary} />
                            <Text style={styles.adminBadgeText}>Admin & Collector</Text>
                          </View>
                        ) : isMemberAdmin ? (
                          <View style={styles.adminBadge}>
                            <Feather name="shield" size={11} color={colors.primary} />
                            <Text style={styles.adminBadgeText}>Admin</Text>
                          </View>
                        ) : isMemberCollector ? (
                          <View style={styles.collectorBadge}>
                            <Feather name="credit-card" size={11} color={colors.success} />
                            <Text style={styles.collectorBadgeText}>Collector</Text>
                          </View>
                        ) : (
                          <Text style={styles.memberRole}>Roommate</Text>
                        )}
                      </View>
                    </View>

                    {isAdmin && !isMemberAdmin && (
                      <Pressable
                        style={styles.removeBtn}
                        onPress={() => handleRemove(member.id, member.name)}
                      >
                        <Feather name="user-minus" size={16} color={colors.inkTertiary} />
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Room Settings Menu */}
            <Text style={[styles.sectionTitle, { marginTop: space.lg }]}>Room Management</Text>
            <View style={styles.cardList}>
              <Pressable
                style={styles.menuRow}
                onPress={() => router.push('/room-settings')}
              >
                <View style={styles.menuIconWrapper}>
                  <Feather name="settings" size={18} color={colors.ink} />
                </View>
                <View style={styles.menuInfo}>
                  <Text style={styles.menuLabel}>Room Settings & Pricing</Text>
                  <Text style={styles.menuSub}>Rent revision, collector & danger zone</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.inkTertiary} />
              </Pressable>

              <Pressable
                style={[styles.menuRow, styles.rowBorder]}
                onPress={() => router.push('/category-management')}
              >
                <View style={styles.menuIconWrapper}>
                  <Feather name="tag" size={18} color={colors.primary} />
                </View>
                <View style={styles.menuInfo}>
                  <Text style={styles.menuLabel}>Expense Categories</Text>
                  <Text style={styles.menuSub}>Add, rename or disable expense tags</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.inkTertiary} />
              </Pressable>

              <Pressable
                style={[styles.menuRow, styles.rowBorder]}
                onPress={() => router.push('/activity-history')}
              >
                <View style={styles.menuIconWrapper}>
                  <Feather name="clock" size={18} color="#7C3AED" />
                </View>
                <View style={styles.menuInfo}>
                  <Text style={styles.menuLabel}>Activity History & Audit Log</Text>
                  <Text style={styles.menuSub}>Complete chronological log of room changes & actions</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.inkTertiary} />
              </Pressable>

              <Pressable
                style={[styles.menuRow, styles.rowBorder]}
                onPress={() => router.push('/invite-modal')}
              >
                <View style={styles.menuIconWrapper}>
                  <Feather name="user-plus" size={18} color={colors.primary} />
                </View>
                <View style={styles.menuInfo}>
                  <Text style={styles.menuLabel}>Invite New Roommate</Text>
                  <Text style={styles.menuSub}>Generate a 7-day shareable invite link</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.inkTertiary} />
              </Pressable>

              <Pressable
                style={[styles.menuRow, styles.rowBorder, { backgroundColor: colors.primarySoft }]}
                onPress={() => router.push('/showcase')}
              >
                <View style={[styles.menuIconWrapper, { backgroundColor: '#FFFFFF' }]}>
                  <Feather name="grid" size={18} color={colors.primary} />
                </View>
                <View style={styles.menuInfo}>
                  <Text style={[styles.menuLabel, { color: colors.primary }]}>UI Component Showcase</Text>
                  <Text style={styles.menuSub}>Interactive preview of all base UI components</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.primary} />
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  container: { padding: space.lg, paddingBottom: space.xxl },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: space.md,
    borderRadius: radius.md,
    borderColor: colors.border,
    borderWidth: 1,
    marginBottom: space.md,
  },
  userInfo: { flex: 1, marginLeft: space.sm },
  userName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  userEmail: { fontSize: 12, color: colors.inkSecondary, marginTop: 1 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs + 2,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerSoft,
  },
  logoutBtnText: { fontSize: 12, fontWeight: '600', color: colors.danger },
  noRoomCard: {
    padding: space.xl,
    alignItems: 'center',
    marginTop: space.md,
  },
  noRoomIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  noRoomTitle: { fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  noRoomDesc: {
    fontSize: 13,
    color: colors.inkSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: space.lg,
  },
  noRoomActions: { width: '100%', gap: space.sm },
  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: space.lg,
    borderRadius: radius.lg,
    borderColor: colors.border,
    borderWidth: 1,
    marginBottom: space.lg,
  },
  roomAvatar: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },
  roomHeaderInfo: { flex: 1 },
  roomName: { fontSize: 17, fontWeight: '700', color: colors.ink },
  roomSub: { fontSize: 12, color: colors.inkSecondary, marginTop: 2 },
  pendingSection: { marginBottom: space.lg },
  pendingHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.xs,
  },
  pendingTitle: { fontSize: 14, fontWeight: '700', color: colors.warning },
  pendingBadge: {
    backgroundColor: colors.warningSoft,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  pendingBadgeText: { fontSize: 10, fontWeight: '700', color: colors.warning },
  pendingCard: { padding: space.sm },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.sm,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.sm + 2,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  inviteBtnText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  cardList: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderColor: colors.border,
    borderWidth: 1,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.surfaceMuted },
  memberInfo: { flex: 1, marginLeft: space.sm },
  memberName: { fontSize: 14, fontWeight: '600', color: colors.ink },
  memberEmail: { fontSize: 12, color: colors.inkSecondary },
  youTag: { color: colors.primary, fontWeight: '700' },
  roleBadgesRow: { flexDirection: 'row', marginTop: 3 },
  memberRole: { fontSize: 12, color: colors.inkTertiary },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  adminBadgeText: { fontSize: 11, fontWeight: '600', color: colors.primary },
  collectorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.successSoft,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  collectorBadgeText: { fontSize: 11, fontWeight: '600', color: colors.success },
  removeBtn: { padding: space.xs },
  menuRow: { flexDirection: 'row', alignItems: 'center', padding: space.md },
  menuIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },
  menuInfo: { flex: 1 },
  menuLabel: { fontSize: 14, fontWeight: '600', color: colors.ink },
  menuSub: { fontSize: 12, color: colors.inkSecondary, marginTop: 1 },
});
