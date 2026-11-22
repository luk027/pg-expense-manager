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
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Card, Button, Input } from '../components/ui';
import { colors, space, radius } from '../lib/tokens';
import { useWaterService } from '../context/WaterServiceContext';
import { useRoom } from '../context/RoomContext';
import { formatPaise } from '../lib/utils';

export default function ServiceConfigScreen() {
  const router = useRouter();
  const { room, isAdmin } = useRoom();
  const { serviceConfig, updateServicePrice } = useWaterService();

  const todayStr = new Date().toISOString().substring(0, 10);

  // Water config state
  const [waterPriceRupees, setWaterPriceRupees] = useState((serviceConfig.waterPricePaise / 100).toString());
  const [waterEffectiveFrom, setWaterEffectiveFrom] = useState(todayStr);
  const [isUpdatingWater, setIsUpdatingWater] = useState(false);

  // Cleaner config state
  const [cleanerSalaryRupees, setCleanerSalaryRupees] = useState((serviceConfig.cleanerPricePaise / 100).toString());
  const [cleanerEffectiveFrom, setCleanerEffectiveFrom] = useState(todayStr);
  const [isUpdatingCleaner, setIsUpdatingCleaner] = useState(false);

  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (RNStatusBar.currentHeight || 28) : 0,
    24
  );

  const handleUpdateWater = async () => {
    const rupees = parseFloat(waterPriceRupees);
    if (isNaN(rupees) || rupees <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price in Rupees.');
      return;
    }

    setIsUpdatingWater(true);
    try {
      const res = await updateServicePrice({
        serviceType: 'water',
        pricePaise: Math.round(rupees * 100),
        effectiveFrom: waterEffectiveFrom,
      });

      if (res.success) {
        Alert.alert('Price Updated', `Water delivery rate set to ₹${rupees} effective ${waterEffectiveFrom}.`);
      } else {
        Alert.alert('Error', res.error || 'Failed to update water price');
      }
    } finally {
      setIsUpdatingWater(false);
    }
  };

  const handleUpdateCleaner = async () => {
    const rupees = parseFloat(cleanerSalaryRupees);
    if (isNaN(rupees) || rupees <= 0) {
      Alert.alert('Invalid Salary', 'Please enter a valid cleaner salary in Rupees.');
      return;
    }

    setIsUpdatingCleaner(true);
    try {
      const res = await updateServicePrice({
        serviceType: 'cleaner',
        pricePaise: Math.round(rupees * 100),
        effectiveFrom: cleanerEffectiveFrom,
      });

      if (res.success) {
        Alert.alert('Salary Updated', `Cleaner salary set to ₹${rupees} effective ${cleanerEffectiveFrom}.`);
      } else {
        Alert.alert('Error', res.error || 'Failed to update cleaner salary');
      }
    } finally {
      setIsUpdatingCleaner(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Service Pricing</Text>
          <Text style={styles.headerSubtitle}>
            {room?.name || 'Flat 302'} • Admin Configuration
          </Text>
        </View>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Feather name="x" size={22} color={colors.inkSecondary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Feather name="shield" size={18} color={colors.primary} />
          <Text style={styles.infoText}>
            Service price updates apply to newly logged deliveries from the effective date forward.
            Historical expenses retain their recorded rate.
          </Text>
        </View>

        {/* Section 1: Water Delivery Pricing */}
        <Card style={styles.sectionCard}>
          <View style={styles.serviceHeader}>
            <View style={styles.serviceIconBox}>
              <Feather name="droplet" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.serviceTitle}>Water Delivery (20L Jug)</Text>
              <Text style={styles.serviceCurrentRate}>
                Active rate: {formatPaise(serviceConfig.waterPricePaise)} / delivery
              </Text>
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>NEW RATE (₹ / DELIVERY)</Text>
              <Input
                value={waterPriceRupees}
                onChangeText={setWaterPriceRupees}
                keyboardType="numeric"
                placeholder="40"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>EFFECTIVE FROM</Text>
              <Input
                value={waterEffectiveFrom}
                onChangeText={setWaterEffectiveFrom}
                placeholder="YYYY-MM-DD"
              />
            </View>
          </View>

          <Button
            title={isUpdatingWater ? 'Updating...' : 'Update Water Rate'}
            variant="primary"
            size="md"
            onPress={handleUpdateWater}
            disabled={isUpdatingWater || !isAdmin}
          />
        </Card>

        {/* Section 2: Maid / Cleaner Monthly Salary */}
        <Card style={styles.sectionCard}>
          <View style={styles.serviceHeader}>
            <View style={styles.serviceIconBox}>
              <Feather name="user-check" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.serviceTitle}>House Cleaner / Maid</Text>
              <Text style={styles.serviceCurrentRate}>
                Active salary: {formatPaise(serviceConfig.cleanerPricePaise)} / month
              </Text>
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>MONTHLY SALARY (₹)</Text>
              <Input
                value={cleanerSalaryRupees}
                onChangeText={setCleanerSalaryRupees}
                keyboardType="numeric"
                placeholder="3000"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>EFFECTIVE FROM</Text>
              <Input
                value={cleanerEffectiveFrom}
                onChangeText={setCleanerEffectiveFrom}
                placeholder="YYYY-MM-DD"
              />
            </View>
          </View>

          <Button
            title={isUpdatingCleaner ? 'Updating...' : 'Update Cleaner Salary'}
            variant="primary"
            size="md"
            onPress={handleUpdateCleaner}
            disabled={isUpdatingCleaner || !isAdmin}
          />
        </Card>

        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Close & Return to Water Tracker</Text>
        </Pressable>
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
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  headerSubtitle: { fontSize: 12, color: colors.inkSecondary, marginTop: 2 },
  closeBtn: { padding: space.xs },
  container: { padding: space.lg, paddingBottom: 60 },

  infoBanner: {
    flexDirection: 'row',
    backgroundColor: colors.primarySoft,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: space.lg,
    gap: space.sm,
    alignItems: 'center',
  },
  infoText: { flex: 1, fontSize: 12, color: colors.inkSecondary, lineHeight: 18 },

  sectionCard: { padding: space.md, marginBottom: space.lg },
  serviceHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  serviceIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  serviceCurrentRate: { fontSize: 12, color: colors.inkSecondary, marginTop: 2 },

  formRow: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  inputLabel: { fontSize: 10, fontWeight: '700', color: colors.inkSecondary, letterSpacing: 0.5, marginBottom: space.xs },

  backLink: { alignItems: 'center', paddingVertical: space.md },
  backLinkText: { fontSize: 13, fontWeight: '600', color: colors.inkSecondary },
});
