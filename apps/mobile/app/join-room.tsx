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

export default function JoinRoomScreen() {
  const router = useRouter();
  const { joinRoom } = useRoom();

  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    if (!token.trim()) {
      setError('Please paste or enter the invitation code');
      return;
    }

    setError(null);
    setLoading(true);

    const result = await joinRoom(token.trim());
    setLoading(false);

    if (result.success) {
      Alert.alert(
        'Request Submitted!',
        `Your request to join ${result.roomName || 'the room'} has been sent. The room admin will approve your request.`,
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/room') }]
      );
    } else {
      setError(result.error || 'Failed to join room');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Join Room</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Have an Invitation?</Text>
            <Text style={styles.cardSub}>
              Enter the invitation code shared by your room admin to request access.
            </Text>

            {error && (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={16} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Input
              label="Invitation Code or Token"
              placeholder="e.g. inv_13d2dcd..."
              value={token}
              onChangeText={setToken}
              autoCapitalize="none"
              leftIcon={<Feather name="key" size={18} color={colors.inkTertiary} />}
              helperText="Ask your room admin for their 7-day invite link"
            />

            <Button
              title="Submit Join Request"
              onPress={handleJoin}
              loading={loading}
              icon={<Feather name="send" size={16} color="#FFFFFF" />}
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
