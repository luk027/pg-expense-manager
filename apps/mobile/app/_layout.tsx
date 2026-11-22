import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { RoomProvider } from '../context/RoomContext';
import { ExpenseProvider } from '../context/ExpenseContext';
import { SettlementProvider } from '../context/SettlementContext';
import { PaymentProvider } from '../context/PaymentContext';
import { WaterServiceProvider } from '../context/WaterServiceContext';
import { NotificationProvider } from '../context/NotificationContext';
import { ReportProvider } from '../context/ReportContext';
import { ActivityProvider } from '../context/ActivityContext';
import { colors } from '../lib/tokens';

function NavigationGuard() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, isLoading, segments]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="create-room" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="join-room" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="invite-modal" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="add-expense" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="edit-expense" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="expense-detail" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="statement-detail" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="finalize-modal" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="pay-settlement" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="collector-confirmations" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="pay-landlord" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="payment-history" options={{ headerShown: false }} />
      <Stack.Screen name="water-delivery" options={{ headerShown: false }} />
      <Stack.Screen name="backdate-water" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="service-config" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="notifications" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="reports" options={{ headerShown: false }} />
      <Stack.Screen name="activity-history" options={{ headerShown: false }} />
      <Stack.Screen name="room-settings" options={{ headerShown: false }} />
      <Stack.Screen name="category-management" options={{ headerShown: false }} />
      <Stack.Screen name="showcase" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <RoomProvider>
          <ExpenseProvider>
            <SettlementProvider>
              <PaymentProvider>
                <WaterServiceProvider>
                  <NotificationProvider>
                    <ReportProvider>
                      <ActivityProvider>
                        <NavigationGuard />
                      </ActivityProvider>
                    </ReportProvider>
                  </NotificationProvider>
                </WaterServiceProvider>
              </PaymentProvider>
            </SettlementProvider>
          </ExpenseProvider>
        </RoomProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
});
