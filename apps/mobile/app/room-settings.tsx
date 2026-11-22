import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Button, Input } from '../components/ui';
import { colors, space, radius } from '../lib/tokens';
import { useRoom, RentHistoryRecord, CloseCheckResult } from '../context/RoomContext';
import { formatPaise, paiseToRupees, rupeesToPaise } from '../lib/utils';

export default function RoomSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    room,
    activeMembers,
    categories,
    isAdmin,
    updateRoom,
    transferAdmin,
    assignCollector,
    closeRoom,
    reopenRoom,
    checkCloseRoom,
    getRentHistory,
    changeRent,
  } = useRoom();

  const isClosed = room?.status === 'closed';

  const [notifications, setNotifications] = useState(room?.notificationsEnabled ?? true);
  const [rentHistory, setRentHistory] = useState<RentHistoryRecord[]>([]);
  const [showRentHistory, setShowRentHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Change rent modal state
  const [isRentModalOpen, setIsRentModalOpen] = useState(false);
  const [newRentRupees, setNewRentRupees] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [rentReason, setRentReason] = useState('');
  const [submittingRent, setSubmittingRent] = useState(false);

  // Close room modal state
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [closeCheck, setCloseCheck] = useState<CloseCheckResult | null>(null);
  const [checkingClose, setCheckingClose] = useState(false);
  const [forceCloseAcknowledge, setForceCloseAcknowledge] = useState(false);
  const [submittingClose, setSubmittingClose] = useState(false);
  const [submittingReopen, setSubmittingReopen] = useState(false);

  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (RNStatusBar.currentHeight || 28) : 0,
    16
  );

  useEffect(() => {
    if (room !== null) {
      setNotifications(room.notificationsEnabled ?? true);
    }
  }, [room?.notificationsEnabled]);

  const loadRentHistory = async () => {
    setLoadingHistory(true);
    const res = await getRentHistory();
    setLoadingHistory(false);
    if (res.success && res.history) {
      setRentHistory(res.history);
    }
  };

  const handleOpenChangeRent = () => {
    const currentRupees = room ? paiseToRupees(room.monthlyRentPaise) : 28000;
    setNewRentRupees(currentRupees.toString());

    // Default effective date: 1st of next month
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const yyyy = nextMonth.getFullYear();
    const mm = String(nextMonth.getMonth() + 1).padStart(2, '0');
    setEffectiveFrom(`${yyyy}-${mm}-01`);
    setRentReason('');
    setIsRentModalOpen(true);
  };

  const handleSaveRentChange = async () => {
    const rentNum = parseFloat(newRentRupees.replace(/,/g, ''));
    if (isNaN(rentNum) || rentNum <= 0) {
      Alert.alert('Invalid Rent', 'Please enter a valid monthly rent amount greater than ₹0.');
      return;
    }

    if (!effectiveFrom.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom.trim())) {
      Alert.alert('Invalid Date', 'Please enter effective date in YYYY-MM-DD format (e.g. 2026-12-01).');
      return;
    }

    setSubmittingRent(true);
    const res = await changeRent(rupeesToPaise(rentNum), effectiveFrom.trim(), rentReason.trim());
    setSubmittingRent(false);

    if (res.success) {
      setIsRentModalOpen(false);
      Alert.alert('Rent Updated', `Monthly room rent has been scheduled/updated to ₹${rentNum.toLocaleString('en-IN')}`);
      loadRentHistory();
    } else {
      Alert.alert('Error', res.error || 'Failed to update rent');
    }
  };

  const handleToggleNotifications = async (val: boolean) => {
    setNotifications(val);
    const res = await updateRoom({ notificationsEnabled: val });
    if (res.success) {
      Alert.alert(
        val ? 'Notifications Enabled' : 'Notifications Stopped',
        val
          ? 'Room activity notifications will be sent to all roommates.'
          : 'Room activity notifications have been stopped. No push alerts will be sent to roommates.'
      );
    } else {
      setNotifications(!val);
      Alert.alert('Error', res.error || 'Failed to update notification settings');
    }
  };

  const handleAssignCollector = (memberId: string, memberName: string) => {
    Alert.alert('Assign Collector', `Assign ${memberName} as the rent collector?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Assign',
        onPress: async () => {
          const res = await assignCollector(memberId);
          if (res.success) {
            Alert.alert('Assigned', `${memberName} is now the rent collector.`);
          } else {
            Alert.alert('Error', res.error || 'Failed to assign collector');
          }
        },
      },
    ]);
  };

  const handleTransferAdmin = (memberId: string, memberName: string) => {
    Alert.alert(
      'Transfer Admin Responsibility',
      `Are you sure you want to transfer full admin responsibility to ${memberName}? You will become a regular roommate.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          style: 'destructive',
          onPress: async () => {
            const res = await transferAdmin(memberId);
            if (res.success) {
              Alert.alert('Transferred', `Admin rights transferred to ${memberName}.`);
              router.replace('/(tabs)/room');
            } else {
              Alert.alert('Error', res.error || 'Failed to transfer admin');
            }
          },
        },
      ]
    );
  };

  const handleInitiateCloseRoom = async () => {
    setCheckingClose(true);
    const res = await checkCloseRoom();
    setCheckingClose(false);

    if (res.success && res.check) {
      setCloseCheck(res.check);
      setForceCloseAcknowledge(false);
      setIsCloseModalOpen(true);
    } else {
      Alert.alert('Error', res.error || 'Failed to check room closure status');
    }
  };

  const handleConfirmClose = async () => {
    if (closeCheck?.hasUnsettledBalances && !forceCloseAcknowledge) {
      Alert.alert(
        'Acknowledgement Required',
        'Please check the box confirming you wish to close the room despite unsettled balances.'
      );
      return;
    }

    setSubmittingClose(true);
    const res = await closeRoom(forceCloseAcknowledge);
    setSubmittingClose(false);

    if (res.success) {
      setIsCloseModalOpen(false);
      Alert.alert('Room Closed', 'This room has been archived. All records are preserved in read-only mode.');
      router.replace('/(tabs)/room');
    } else {
      Alert.alert('Closure Failed', res.error || 'Could not close the room');
    }
  };

  const handleReopenRoom = async () => {
    Alert.alert(
      'Reopen Room',
      'Are you sure you want to reopen this room? This will restore it to active status, allowing roommates to add expenses and make payments.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reopen Room',
          onPress: async () => {
            setSubmittingReopen(true);
            const res = await reopenRoom();
            setSubmittingReopen(false);
            if (res.success) {
              Alert.alert('Reopened', 'The room is now active again.');
            } else {
              Alert.alert('Error', res.error || 'Failed to reopen room');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.header, { paddingTop: topInset + 4 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Feather name="arrow-left" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Room Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Closed Room Banner */}
        {isClosed && (
          <Card style={styles.closedBanner}>
            <View style={styles.closedHeaderRow}>
              <Feather name="archive" size={20} color={colors.warning} />
              <View style={{ flex: 1, marginLeft: space.sm }}>
                <Text style={styles.closedBannerTitle}>Room is Archived & Closed</Text>
                <Text style={styles.closedBannerText}>
                  This room was closed on {room?.closedAt ? new Date(room.closedAt).toLocaleDateString('en-IN') : 'archive'}. No new expenses or payments are permitted.
                </Text>
              </View>
            </View>
            {isAdmin && (
              <Button
                title="Reopen Room"
                variant="outline"
                size="sm"
                onPress={handleReopenRoom}
                loading={submittingReopen}
                style={{ marginTop: space.md, alignSelf: 'flex-start' }}
                icon={<Feather name="rotate-ccw" size={14} color={colors.primary} />}
              />
            )}
          </Card>
        )}

        {/* Monthly Rent & History */}
        <Text style={styles.sectionTitle}>Rent Management</Text>
        <Card style={styles.card}>
          <View style={styles.rentHeaderRow}>
            <View>
              <Text style={styles.rentLabel}>Current Total Room Rent</Text>
              <Text style={styles.rentValue}>
                {room ? formatPaise(room.monthlyRentPaise) : '₹0'}
                <Text style={styles.rentPeriod}> / month</Text>
              </Text>
            </View>
            {isAdmin && !isClosed && (
              <Button
                title="Change Rent"
                size="sm"
                onPress={handleOpenChangeRent}
                icon={<Feather name="edit" size={14} color="#FFFFFF" />}
              />
            )}
          </View>

          {/* Rent History Dropdown Toggle */}
          <Pressable
            style={styles.historyToggleRow}
            onPress={() => {
              if (!showRentHistory && rentHistory.length === 0) {
                loadRentHistory();
              }
              setShowRentHistory(!showRentHistory);
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Feather name="clock" size={14} color={colors.primary} />
              <Text style={styles.historyToggleText}>Rent Revision History</Text>
            </View>
            <Feather
              name={showRentHistory ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.inkTertiary}
            />
          </Pressable>

          {showRentHistory && (
            <View style={styles.historyContainer}>
              {loadingHistory ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: space.md }} />
              ) : rentHistory.length === 0 ? (
                <Text style={styles.emptyHistoryText}>No rent changes recorded yet.</Text>
              ) : (
                rentHistory.map((item, idx) => (
                  <View
                    key={item.id}
                    style={[
                      styles.historyItem,
                      idx < rentHistory.length - 1 && styles.historyItemBorder,
                    ]}
                  >
                    <View style={styles.historyTopRow}>
                      <Text style={styles.historyRent}>
                        {formatPaise(item.newRentPaise)}
                      </Text>
                      <Text style={styles.historyEffective}>
                        Effective {item.effectiveFrom}
                      </Text>
                    </View>
                    <Text style={styles.historyMeta}>
                      Changed by {item.changedByName}
                      {item.previousRentPaise ? ` (from ${formatPaise(item.previousRentPaise)})` : ''}
                    </Text>
                    {item.reason && (
                      <Text style={styles.historyReason}>"{item.reason}"</Text>
                    )}
                  </View>
                ))
              )}
            </View>
          )}
        </Card>

        {/* Category Management Row */}
        <Text style={[styles.sectionTitle, { marginTop: space.lg }]}>Categories</Text>
        <Card style={styles.card}>
          <Pressable
            style={styles.menuNavRow}
            onPress={() => router.push('/category-management')}
          >
            <View style={styles.menuNavIcon}>
              <Feather name="tag" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: space.sm }}>
              <Text style={styles.menuNavTitle}>Expense Categories</Text>
              <Text style={styles.menuNavSub}>
                {categories.filter((c) => c.isActive !== false).length} active • Manage tags & rules
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.inkTertiary} />
          </Pressable>
        </Card>

        {/* Notifications */}
        <Text style={[styles.sectionTitle, { marginTop: space.lg }]}>Room Notifications</Text>
        <Card style={styles.card}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Activity Notifications</Text>
              <Text style={styles.switchSub}>Notify all roommates for expenses and payments</Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: colors.border, true: colors.primary }}
              disabled={!isAdmin || isClosed}
            />
          </View>
        </Card>

        {/* Collector Assignment (Admin Only) */}
        {isAdmin && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: space.lg }]}>Assign Rent Collector</Text>
            <Card style={styles.card}>
              <Text style={styles.cardDesc}>
                The collector confirms payments and records rent paid to landlord.
              </Text>
              {activeMembers.map((m) => {
                const isCurrentCollector = room?.collectorId === m.userId;
                return (
                  <Pressable
                    key={m.id}
                    style={[styles.memberItem, isCurrentCollector && styles.memberItemActive]}
                    onPress={() =>
                      !isCurrentCollector && !isClosed && handleAssignCollector(m.userId, m.name)
                    }
                    disabled={isClosed}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{m.name}</Text>
                      <Text style={styles.memberEmail}>{m.email}</Text>
                    </View>
                    {isCurrentCollector ? (
                      <View style={styles.activePill}>
                        <Feather name="check" size={12} color={colors.success} />
                        <Text style={styles.activePillText}>Current Collector</Text>
                      </View>
                    ) : (
                      <Text style={[styles.assignText, isClosed && { color: colors.inkTertiary }]}>
                        Make Collector
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </Card>

            {/* Transfer Admin */}
            <Text style={[styles.sectionTitle, { marginTop: space.lg }]}>Transfer Admin Role</Text>
            <Card style={styles.card}>
              <Text style={styles.cardDesc}>
                Transfer room administration rights to another active roommate.
              </Text>
              {activeMembers
                .filter((m) => m.userId !== room?.adminId)
                .map((m) => (
                  <View key={m.id} style={styles.memberItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{m.name}</Text>
                      <Text style={styles.memberEmail}>{m.email}</Text>
                    </View>
                    <Button
                      title="Transfer"
                      variant="outline"
                      size="sm"
                      disabled={isClosed}
                      onPress={() => handleTransferAdmin(m.userId, m.name)}
                    />
                  </View>
                ))}
            </Card>

            {/* Danger Zone: Room Closure */}
            <Text style={[styles.sectionTitle, { marginTop: space.lg, color: colors.danger }]}>
              Danger Zone
            </Text>
            <Card style={[styles.card, { borderColor: '#FECDD3' }]}>
              <Text style={styles.cardDesc}>
                Closing the room will archive it and prevent any new expenses or payments.
              </Text>
              {isClosed ? (
                <View style={{ marginTop: space.sm }}>
                  <Text style={{ fontSize: 13, color: colors.inkSecondary, fontStyle: 'italic' }}>
                    This room is currently archived and closed.
                  </Text>
                  <Button
                    title="Reopen Room"
                    variant="outline"
                    size="sm"
                    onPress={handleReopenRoom}
                    loading={submittingReopen}
                    style={{ marginTop: space.sm }}
                    icon={<Feather name="rotate-ccw" size={14} color={colors.primary} />}
                  />
                </View>
              ) : (
                <Button
                  title="Close and Archive Room"
                  variant="destructive"
                  size="sm"
                  onPress={handleInitiateCloseRoom}
                  loading={checkingClose}
                  style={{ marginTop: space.sm }}
                />
              )}
            </Card>
          </>
        )}
      </ScrollView>

      {/* Change Rent Modal */}
      <Modal visible={isRentModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Room Rent</Text>
              <Pressable onPress={() => setIsRentModalOpen(false)} hitSlop={10}>
                <Feather name="x" size={20} color={colors.inkSecondary} />
              </Pressable>
            </View>

            <Input
              label="New Monthly Rent (₹)"
              value={newRentRupees}
              onChangeText={setNewRentRupees}
              keyboardType="numeric"
              placeholder="e.g. 30000"
            />

            <Input
              label="Effective From (YYYY-MM-DD)"
              value={effectiveFrom}
              onChangeText={setEffectiveFrom}
              placeholder="e.g. 2026-12-01"
            />

            <Input
              label="Reason for Change (Optional)"
              value={rentReason}
              onChangeText={setRentReason}
              placeholder="e.g. Annual landlord rent revision"
            />

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="outline"
                size="sm"
                onPress={() => setIsRentModalOpen(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Save Revision"
                size="sm"
                onPress={handleSaveRentChange}
                loading={submittingRent}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Close Room Confirmation Modal with Balance Check */}
      <Modal visible={isCloseModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Feather name="alert-triangle" size={20} color={colors.danger} />
                <Text style={[styles.modalTitle, { color: colors.danger }]}>Close Room</Text>
              </View>
              <Pressable onPress={() => setIsCloseModalOpen(false)} hitSlop={10}>
                <Feather name="x" size={20} color={colors.inkSecondary} />
              </Pressable>
            </View>

            {closeCheck?.hasUnsettledBalances ? (
              <View style={styles.warningBox}>
                <Text style={styles.warningTitle}>⚠️ Unsettled Balances Detected!</Text>
                <Text style={styles.warningMessage}>{closeCheck.warning}</Text>
                {closeCheck.unpaidMembers.length > 0 && (
                  <Text style={styles.warningMembers}>
                    Pending Roommates: {closeCheck.unpaidMembers.join(', ')}
                  </Text>
                )}
                <View style={styles.acknowledgeRow}>
                  <Switch
                    value={forceCloseAcknowledge}
                    onValueChange={setForceCloseAcknowledge}
                    trackColor={{ false: colors.border, true: colors.danger }}
                  />
                  <Text style={styles.acknowledgeText}>
                    I acknowledge that unsettled balances exist and want to close the room anyway.
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.modalBodyText}>
                All room expenses and member balances are fully settled! Are you sure you want to close and archive this room?
              </Text>
            )}

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="outline"
                size="sm"
                onPress={() => setIsCloseModalOpen(false)}
                style={{ flex: 1 }}
              />
              <Button
                title={closeCheck?.hasUnsettledBalances ? 'Force Close' : 'Confirm Close'}
                variant="destructive"
                size="sm"
                onPress={handleConfirmClose}
                loading={submittingClose}
                disabled={closeCheck?.hasUnsettledBalances && !forceCloseAcknowledge}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { marginRight: space.md },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  container: { padding: space.lg, paddingBottom: space.xxl },
  closedBanner: {
    backgroundColor: colors.warningSoft,
    borderColor: '#FEDF89',
    borderWidth: 1,
    padding: space.md,
    marginBottom: space.lg,
  },
  closedHeaderRow: { flexDirection: 'row', alignItems: 'flex-start' },
  closedBannerTitle: { fontSize: 14, fontWeight: '700', color: colors.warning },
  closedBannerText: { fontSize: 12, color: colors.inkSecondary, marginTop: 2, lineHeight: 16 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.inkSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: space.sm,
  },
  card: { padding: space.md },
  cardDesc: { fontSize: 13, color: colors.inkSecondary },
  rentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rentLabel: { fontSize: 12, color: colors.inkSecondary, fontWeight: '500' },
  rentValue: { fontSize: 22, fontWeight: '700', color: colors.ink, marginTop: 2 },
  rentPeriod: { fontSize: 13, fontWeight: '400', color: colors.inkTertiary },
  historyToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space.md,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  historyToggleText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  historyContainer: { marginTop: space.sm },
  historyItem: { paddingVertical: space.sm },
  historyItemBorder: { borderBottomWidth: 1, borderBottomColor: colors.surfaceMuted },
  historyTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyRent: { fontSize: 14, fontWeight: '700', color: colors.ink },
  historyEffective: { fontSize: 12, color: colors.inkSecondary },
  historyMeta: { fontSize: 11, color: colors.inkTertiary, marginTop: 2 },
  historyReason: { fontSize: 11, color: colors.inkSecondary, fontStyle: 'italic', marginTop: 2 },
  emptyHistoryText: { fontSize: 12, color: colors.inkTertiary, textAlign: 'center', marginVertical: space.sm },
  menuNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuNavIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuNavTitle: { fontSize: 15, fontWeight: '600', color: colors.ink },
  menuNavSub: { fontSize: 12, color: colors.inkSecondary, marginTop: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center' },
  switchLabel: { fontSize: 14, fontWeight: '600', color: colors.ink },
  switchSub: { fontSize: 12, color: colors.inkSecondary, marginTop: 1 },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
    marginTop: space.xs,
  },
  memberItemActive: { backgroundColor: colors.successSoft, borderRadius: 8, paddingHorizontal: space.xs },
  memberName: { fontSize: 14, fontWeight: '600', color: colors.ink },
  memberEmail: { fontSize: 12, color: colors.inkSecondary },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: 999,
  },
  activePillText: { fontSize: 11, fontWeight: '700', color: colors.success },
  assignText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.md,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  modalBodyText: { fontSize: 14, color: colors.inkSecondary, lineHeight: 20, marginBottom: space.lg },
  warningBox: {
    backgroundColor: colors.dangerSoft,
    borderColor: '#FECDCA',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.lg,
  },
  warningTitle: { fontSize: 13, fontWeight: '700', color: colors.danger, marginBottom: space.xs },
  warningMessage: { fontSize: 12, color: colors.ink, lineHeight: 17, marginBottom: space.xs },
  warningMembers: { fontSize: 11, color: colors.inkSecondary, marginBottom: space.sm },
  acknowledgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.xs,
    paddingTop: space.xs,
    borderTopWidth: 1,
    borderTopColor: '#FECDCA',
  },
  acknowledgeText: { flex: 1, fontSize: 11, color: colors.danger, fontWeight: '600' },
  modalActions: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.sm,
  },
});
