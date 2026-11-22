import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Pressable,
  Share,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Card, Button } from '../components/ui';
import { colors, space, radius } from '../lib/tokens';
import { useRoom } from '../context/RoomContext';

export default function InviteModal() {
  const router = useRouter();
  const { room, generateInvite } = useRoom();

  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  useEffect(() => {
    async function loadToken() {
      const res = await generateInvite();
      setLoading(false);
      if (res.success && res.token) {
        setToken(res.token);
        setInviteUrl(res.inviteUrl || `pgexpense://join?token=${res.token}`);
      } else {
        Alert.alert('Error', res.error || 'Could not generate invite link');
      }
    }
    loadToken();
  }, []);

  const handleShare = async () => {
    if (!token) return;
    try {
      await Share.share({
        message: `Join ${room?.name || 'our shared room'} on PG Expense Manager using this invite code:\n\n${token}\n\nOpen app: ${inviteUrl}`,
        title: `Invite to ${room?.name}`,
      });
    } catch (err) {
      console.warn('Share dismissed or failed', err);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="x" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Invite Roommate</Text>
      </View>

      <View style={styles.container}>
        <Card style={styles.card}>
          <View style={styles.iconCircle}>
            <Feather name="user-plus" size={32} color={colors.primary} />
          </View>
          <Text style={styles.title}>Invite a Roommate</Text>
          <Text style={styles.description}>
            Share this secure code with your new roommate. The invitation link is valid for 7 days.
          </Text>

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: space.xl }} />
          ) : token ? (
            <>
              <View style={styles.tokenBox}>
                <Text style={styles.tokenLabel}>INVITATION CODE</Text>
                <Text style={styles.tokenText} selectable>
                  {token}
                </Text>
              </View>

              <Button
                title="Share Invitation"
                onPress={handleShare}
                icon={<Feather name="share-2" size={16} color="#FFFFFF" />}
                style={styles.shareBtn}
              />
            </>
          ) : (
            <Text style={styles.errorText}>Failed to generate invitation code.</Text>
          )}
        </Card>
      </View>
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
  container: { padding: space.lg, flex: 1, justifyContent: 'center' },
  card: { alignItems: 'center', padding: space.xl },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  description: {
    fontSize: 13,
    color: colors.inkSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: space.lg,
  },
  tokenBox: {
    width: '100%',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    alignItems: 'center',
    marginBottom: space.lg,
  },
  tokenLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  tokenText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
  },
  shareBtn: { width: '100%' },
  errorText: { color: colors.danger, fontWeight: '600', marginVertical: space.md },
});
