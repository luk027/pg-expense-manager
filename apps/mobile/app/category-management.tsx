import React, { useState } from 'react';
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
import { Card, Button } from '../components/ui';
import { colors, space, radius } from '../lib/tokens';
import { useRoom, RoomCategoryItem } from '../context/RoomContext';

export default function CategoryManagementScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { categories, isAdmin, addCategory, updateCategory, deleteCategory } = useRoom();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  const [renameTarget, setRenameTarget] = useState<RoomCategoryItem | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isSubmittingRename, setIsSubmittingRename] = useState(false);

  const activeCategories = categories.filter((c) => c.isActive !== false);
  const disabledCategories = categories.filter((c) => c.isActive === false);

  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (RNStatusBar.currentHeight || 28) : 0,
    16
  );

  const handleOpenAddModal = () => {
    setNewCatName('');
    setIsAddModalOpen(true);
  };

  const handleAddCategory = async () => {
    const trimmed = newCatName.trim();
    if (!trimmed) {
      Alert.alert('Required', 'Please enter a category name');
      return;
    }
    if (trimmed.length < 2 || trimmed.length > 30) {
      Alert.alert('Invalid Name', 'Category name must be between 2 and 30 characters');
      return;
    }

    const exists = categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      Alert.alert('Duplicate Category', `A category named "${trimmed}" already exists.`);
      return;
    }

    setIsSubmittingAdd(true);
    const res = await addCategory(trimmed);
    setIsSubmittingAdd(false);

    if (res.success) {
      setIsAddModalOpen(false);
      setNewCatName('');
      Alert.alert('Success', `Category "${trimmed}" has been added.`);
    } else {
      Alert.alert('Error', res.error || 'Failed to add category');
    }
  };

  const handleOpenRename = (cat: RoomCategoryItem) => {
    setRenameTarget(cat);
    setRenameValue(cat.name);
  };

  const handleSaveRename = async () => {
    if (!renameTarget) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      Alert.alert('Required', 'Category name cannot be empty');
      return;
    }
    if (trimmed.toLowerCase() === renameTarget.name.toLowerCase()) {
      setRenameTarget(null);
      return;
    }

    const exists = categories.some(
      (c) => c.id !== renameTarget.id && c.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      Alert.alert('Duplicate Category', `A category named "${trimmed}" already exists.`);
      return;
    }

    setIsSubmittingRename(true);
    const res = await updateCategory(renameTarget.id, { name: trimmed });
    setIsSubmittingRename(false);

    if (res.success) {
      setRenameTarget(null);
      Alert.alert('Renamed', `Category updated to "${trimmed}".`);
    } else {
      Alert.alert('Error', res.error || 'Failed to rename category');
    }
  };

  const handleToggleActive = async (cat: RoomCategoryItem, nextActive: boolean) => {
    if (!isAdmin) return;

    if (!nextActive) {
      Alert.alert(
        'Disable Category',
        `Disabling "${cat.name}" will hide it from the Add Expense screen, but all existing expenses under this category will remain unchanged.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: async () => {
              const res = await updateCategory(cat.id, { isActive: false });
              if (!res.success) {
                Alert.alert('Error', res.error || 'Failed to disable category');
              }
            },
          },
        ]
      );
    } else {
      const res = await updateCategory(cat.id, { isActive: true });
      if (!res.success) {
        Alert.alert('Error', res.error || 'Failed to enable category');
      }
    }
  };

  const handleDelete = (cat: RoomCategoryItem) => {
    if (!isAdmin) return;
    Alert.alert(
      'Delete Category',
      `Are you sure you want to remove "${cat.name}"? If any expenses exist under this category, it will be safely disabled instead of permanently removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const res = await deleteCategory(cat.id);
            if (res.success) {
              Alert.alert('Success', res.message || 'Category processed successfully.');
            } else {
              Alert.alert('Error', res.error || 'Failed to remove category');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topInset + 4 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Feather name="arrow-left" size={22} color={colors.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Category Management</Text>
          <Text style={styles.headerSub}>Manage custom & default room expense tags</Text>
        </View>
        {isAdmin && (
          <Pressable style={styles.addHeaderBtn} onPress={handleOpenAddModal}>
            <Feather name="plus" size={16} color="#FFFFFF" />
            <Text style={styles.addHeaderBtnText}>Add</Text>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Info Card */}
        <Card style={styles.infoBanner}>
          <Feather name="info" size={18} color={colors.primary} style={{ marginTop: 2 }} />
          <View style={{ flex: 1, marginLeft: space.sm }}>
            <Text style={styles.infoBannerTitle}>Category Management Rules</Text>
            <Text style={styles.infoBannerText}>
              Categories used in past expenses are protected: deleting an in-use category will automatically disable it so historical statements stay intact.
            </Text>
          </View>
        </Card>

        {/* Active Categories Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Active Categories ({activeCategories.length})</Text>
          <Text style={styles.sectionBadgeText}>Available for new expenses</Text>
        </View>

        <Card style={styles.categoryCard}>
          {activeCategories.map((cat, idx) => (
            <View
              key={cat.id}
              style={[
                styles.categoryRow,
                idx < activeCategories.length - 1 && styles.rowDivider,
              ]}
            >
              <View style={styles.categoryInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.categoryName}>{cat.name}</Text>
                  {cat.isDefault && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultBadgeText}>Default</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.categoryStatusActive}>• Active</Text>
              </View>

              {isAdmin && (
                <View style={styles.categoryActions}>
                  <Pressable
                    style={styles.actionIconBtn}
                    onPress={() => handleOpenRename(cat)}
                    hitSlop={8}
                  >
                    <Feather name="edit-2" size={16} color={colors.inkSecondary} />
                  </Pressable>
                  <Switch
                    value={true}
                    onValueChange={(val) => handleToggleActive(cat, val)}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                  />
                  <Pressable
                    style={styles.actionIconBtn}
                    onPress={() => handleDelete(cat)}
                    hitSlop={8}
                  >
                    <Feather name="trash-2" size={16} color={colors.danger} />
                  </Pressable>
                </View>
              )}
            </View>
          ))}
        </Card>

        {/* Disabled Categories Section */}
        {disabledCategories.length > 0 && (
          <>
            <View style={[styles.sectionHeaderRow, { marginTop: space.xl }]}>
              <Text style={[styles.sectionTitle, { color: colors.inkTertiary }]}>
                Disabled Categories ({disabledCategories.length})
              </Text>
              <Text style={styles.sectionBadgeText}>Hidden from add expense</Text>
            </View>

            <Card style={styles.categoryCard}>
              {disabledCategories.map((cat, idx) => (
                <View
                  key={cat.id}
                  style={[
                    styles.categoryRow,
                    idx < disabledCategories.length - 1 && styles.rowDivider,
                    { opacity: 0.75 },
                  ]}
                >
                  <View style={styles.categoryInfo}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.categoryName, { color: colors.inkSecondary }]}>
                        {cat.name}
                      </Text>
                      {cat.isDefault && (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>Default</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.categoryStatusDisabled}>• Disabled</Text>
                  </View>

                  {isAdmin && (
                    <View style={styles.categoryActions}>
                      <Pressable
                        style={styles.actionIconBtn}
                        onPress={() => handleOpenRename(cat)}
                        hitSlop={8}
                      >
                        <Feather name="edit-2" size={16} color={colors.inkSecondary} />
                      </Pressable>
                      <Switch
                        value={false}
                        onValueChange={(val) => handleToggleActive(cat, val)}
                        trackColor={{ false: colors.border, true: colors.primary }}
                        style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                      />
                      <Pressable
                        style={styles.actionIconBtn}
                        onPress={() => handleDelete(cat)}
                        hitSlop={8}
                      >
                        <Feather name="trash-2" size={16} color={colors.danger} />
                      </Pressable>
                    </View>
                  )}
                </View>
              ))}
            </Card>
          </>
        )}

        {!isAdmin && (
          <View style={styles.readOnlyFooter}>
            <Feather name="lock" size={14} color={colors.inkTertiary} />
            <Text style={styles.readOnlyText}>
              Only the room admin can add, rename, or toggle room categories.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Add Category Modal */}
      <Modal visible={isAddModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Expense Category</Text>
              <Pressable onPress={() => setIsAddModalOpen(false)} hitSlop={10}>
                <Feather name="x" size={20} color={colors.inkSecondary} />
              </Pressable>
            </View>

            <Text style={styles.inputLabel}>Category Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Maid & Cleaning, Laundry"
              placeholderTextColor={colors.inkTertiary}
              value={newCatName}
              onChangeText={setNewCatName}
              autoFocus
              maxLength={30}
            />

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="outline"
                size="sm"
                onPress={() => setIsAddModalOpen(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Create Category"
                size="sm"
                onPress={handleAddCategory}
                loading={isSubmittingAdd}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Rename Category Modal */}
      <Modal visible={renameTarget !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rename Category</Text>
              <Pressable onPress={() => setRenameTarget(null)} hitSlop={10}>
                <Feather name="x" size={20} color={colors.inkSecondary} />
              </Pressable>
            </View>

            <Text style={styles.inputLabel}>New Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Category name"
              placeholderTextColor={colors.inkTertiary}
              value={renameValue}
              onChangeText={setRenameValue}
              autoFocus
              maxLength={30}
            />

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="outline"
                size="sm"
                onPress={() => setRenameTarget(null)}
                style={{ flex: 1 }}
              />
              <Button
                title="Save"
                size="sm"
                onPress={handleSaveRename}
                loading={isSubmittingRename}
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
    gap: space.sm,
  },
  backBtn: { padding: space.xs },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  headerSub: { fontSize: 12, color: colors.inkSecondary, marginTop: 1 },
  addHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radius.pill,
  },
  addHeaderBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  container: { padding: space.lg, paddingBottom: space.xxl },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderColor: '#C7D2FE',
    borderWidth: 1,
    padding: space.md,
    marginBottom: space.lg,
  },
  infoBannerTitle: { fontSize: 13, fontWeight: '700', color: colors.primary },
  infoBannerText: { fontSize: 12, color: colors.inkSecondary, marginTop: 2, lineHeight: 16 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.inkSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionBadgeText: { fontSize: 11, color: colors.inkTertiary },
  categoryCard: { padding: 0, overflow: 'hidden' },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  categoryName: { fontSize: 15, fontWeight: '600', color: colors.ink },
  defaultBadge: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  defaultBadgeText: { fontSize: 10, fontWeight: '600', color: colors.inkSecondary },
  categoryStatusActive: { fontSize: 11, color: colors.success, marginTop: 2, fontWeight: '500' },
  categoryStatusDisabled: { fontSize: 11, color: colors.inkTertiary, marginTop: 2, fontWeight: '500' },
  categoryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  actionIconBtn: {
    padding: space.xs,
    borderRadius: radius.sm,
  },
  readOnlyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    marginTop: space.xl,
    paddingHorizontal: space.md,
  },
  readOnlyText: { fontSize: 12, color: colors.inkTertiary, textAlign: 'center' },
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
  inputLabel: { fontSize: 13, fontWeight: '600', color: colors.inkSecondary, marginBottom: space.xs },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.surfaceMuted,
    marginBottom: space.lg,
  },
  modalActions: {
    flexDirection: 'row',
    gap: space.sm,
  },
});
