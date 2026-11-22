import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Card, Button, Input } from '../components/ui';
import { colors, space } from '../lib/tokens';
import { useRoom } from '../context/RoomContext';
import { rupeesToPaise } from '../lib/utils';

export default function CreateRoomScreen() {
  const router = useRouter();
  const { createRoom } = useRoom();

  const [name, setName] = useState('');
  const [rentRupees, setRentRupees] = useState('28000');
  const [settlementDay, setSettlementDay] = useState('28');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Please enter a room or flat name');
      return;
    }

    const rentNum = parseFloat(rentRupees);
    if (isNaN(rentNum) || rentNum <= 0) {
      setError('Please enter a valid monthly rent amount');
      return;
    }

    const dayNum = parseInt(settlementDay, 10);
    if (isNaN(dayNum) || dayNum < 1 || dayNum > 28) {
      setError('Settlement day must be between 1 and 28');
      return;
    }

    setError(null);
    setLoading(true);

    const rentPaise = rupeesToPaise(rentNum);
    const result = await createRoom(name.trim(), rentPaise, dayNum);
    setLoading(false);

    if (result.success) {
      Alert.alert('Room Created!', `${name} is ready. 9 default categories have been configured.`, [
        { text: 'Go to Room', onPress: () => router.replace('/(tabs)/room') },
      ]);
    } else {
      setError(result.error || 'Failed to create room');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Create New Room</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Room Information</Text>
            <Text style={styles.cardSub}>
              You will be assigned as the Room Admin and initial Rent Collector.
            </Text>

            {error && (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={16} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Input
              label="Room / Flat Name"
              placeholder="e.g. Flat 302, Green Glen"
              value={name}
              onChangeText={setName}
              leftIcon={<Feather name="home" size={18} color={colors.inkTertiary} />}
            />

            <Input
              label="Total Monthly Room Rent (₹)"
              placeholder="e.g. 28000"
              keyboardType="numeric"
              value={rentRupees}
              onChangeText={setRentRupees}
              leftIcon={<Feather name="credit-card" size={18} color={colors.inkTertiary} />}
              helperText="This total will be equally divided among all active roommates"
            />

            <Input
              label="Monthly Settlement Day (1 - 28)"
              placeholder="28"
              keyboardType="numeric"
              value={settlementDay}
              onChangeText={setSettlementDay}
              leftIcon={<Feather name="calendar" size={18} color={colors.inkTertiary} />}
              helperText="Default is 28th of every month"
            />

            <Button
              title="Create Room"
              onPress={handleCreate}
              loading={loading}
              icon={<Feather name="check" size={16} color="#FFFFFF" />}
              style={styles.submitBtn}
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
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
  container: { padding: space.lg },
  card: { padding: space.lg },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  cardSub: { fontSize: 13, color: colors.inkSecondary, marginTop: 2, marginBottom: space.lg },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.dangerSoft,
    padding: space.sm,
    borderRadius: 8,
    marginBottom: space.md,
  },
  errorText: { color: colors.danger, fontSize: 12, fontWeight: '600', flex: 1 },
  submitBtn: { marginTop: space.sm },
});
