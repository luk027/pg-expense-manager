import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  Card,
  Button,
  Amount,
  Badge,
  StatusPill,
  Input,
  Avatar,
  LoadingSkeleton,
  EmptyState,
  ErrorState,
} from '../components/ui';
import { colors, space } from '../lib/tokens';

export default function ShowcaseScreen() {
  const router = useRouter();
  const [testText, setTestText] = useState('');
  const [btnLoading, setBtnLoading] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>UI Component Showcase</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* 1. BUTTONS */}
        <Text style={styles.sectionHeader}>1. Buttons & Variants</Text>
        <Card style={styles.cardSection}>
          <View style={styles.gap}>
            <Button
              title="Primary Button"
              onPress={() => {}}
              icon={<Feather name="check" size={16} color="#FFFFFF" />}
            />
            <Button
              title="Secondary Button"
              variant="secondary"
              onPress={() => {}}
              icon={<Feather name="plus" size={16} color={colors.primary} />}
            />
            <Button
              title="Outline Button"
              variant="outline"
              onPress={() => {}}
            />
            <Button
              title="Destructive Button"
              variant="destructive"
              onPress={() => {}}
              icon={<Feather name="trash-2" size={16} color="#FFFFFF" />}
            />
            <Button
              title="Loading State"
              loading={btnLoading}
              onPress={() => {
                setBtnLoading(true);
                setTimeout(() => setBtnLoading(false), 2000);
              }}
            />
            <Button title="Disabled Button" disabled onPress={() => {}} />
            <View style={styles.row}>
              <Button title="Small" size="sm" onPress={() => {}} style={{ flex: 1 }} />
              <Button title="Medium" size="md" onPress={() => {}} style={{ flex: 1 }} />
            </View>
          </View>
        </Card>

        {/* 2. AMOUNTS */}
        <Text style={styles.sectionHeader}>2. Indian Currency Formatting (Paise)</Text>
        <Card style={styles.cardSection}>
          <View style={styles.gap}>
            <Amount paise={425000} semantic="owed" size="hero" prefix="You owe" />
            <Amount paise={1840000} semantic="primary" size="title" prefix="Room total:" />
            <Amount paise={2800000} semantic="received" size="body" prefix="Settled:" />
            <Amount paise={25050} semantic="neutral" size="caption" prefix="Grocery share:" />
          </View>
        </Card>

        {/* 3. STATUS PILLS & BADGES */}
        <Text style={styles.sectionHeader}>3. Status Pills & Badges</Text>
        <Card style={styles.cardSection}>
          <View style={styles.badgeWrap}>
            <StatusPill status="confirmed" />
            <StatusPill status="settled" />
            <StatusPill status="awaiting" />
            <StatusPill status="pending" />
            <StatusPill status="draft" />
            <StatusPill status="reversed" />
          </View>
          <View style={[styles.badgeWrap, { marginTop: space.md }]}>
            <Badge label="Electricity" variant="warning" />
            <Badge label="Groceries" variant="primary" />
            <Badge label="Wi-Fi" variant="success" />
            <Badge label="Admin" variant="danger" />
            <Badge label="Standard" variant="neutral" />
          </View>
        </Card>

        {/* 4. AVATARS */}
        <Text style={styles.sectionHeader}>4. Avatars</Text>
        <Card style={styles.cardSection}>
          <View style={styles.row}>
            <Avatar name="Rahul Sharma" size="sm" />
            <Avatar name="Aman Verma" size="md" />
            <Avatar name="Kunal Patel" size="lg" />
            <Avatar name="Sameer Rao" size="xl" />
          </View>
        </Card>

        {/* 5. INPUTS */}
        <Text style={styles.sectionHeader}>5. Form Inputs</Text>
        <Card style={styles.cardSection}>
          <Input
            label="Normal Input"
            placeholder="Type something..."
            value={testText}
            onChangeText={setTestText}
            leftIcon={<Feather name="edit-3" size={16} color={colors.inkTertiary} />}
            helperText="Character count updates live"
          />
          <Input
            label="Error State Input"
            placeholder="Invalid input"
            value="invalid-entry"
            error="Amount cannot exceed total monthly rent"
          />
        </Card>

        {/* 6. LOADING SKELETONS */}
        <Text style={styles.sectionHeader}>6. Loading Skeletons (Animated Pulse)</Text>
        <Card style={styles.cardSection}>
          <View style={styles.gap}>
            <LoadingSkeleton width="70%" height={20} />
            <LoadingSkeleton width="100%" height={14} />
            <LoadingSkeleton width="45%" height={14} />
          </View>
        </Card>

        {/* 7. EMPTY STATE */}
        <Text style={styles.sectionHeader}>7. Empty State</Text>
        <EmptyState
          icon="calendar"
          title="No expenses for this date"
          description="You can add a new shared room expense or mark a water delivery."
          actionTitle="Add New Expense"
          onActionPress={() => {}}
        />

        {/* 8. ERROR STATE */}
        <Text style={[styles.sectionHeader, { marginTop: space.lg }]}>8. Error State</Text>
        <ErrorState
          title="Connection interrupted"
          message="Could not reach the room sync server. Please check your network connection."
          onRetry={() => {}}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { marginRight: space.md },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  container: { padding: space.lg, paddingBottom: space.xxl },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.inkSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  cardSection: {
    marginBottom: space.sm,
  },
  gap: { gap: space.sm + 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  badgeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
});
