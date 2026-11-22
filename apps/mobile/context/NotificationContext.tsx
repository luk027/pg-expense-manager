import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useAuth } from './AuthContext';
import { useRoom } from './RoomContext';

// Configure notification presentation when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type NotificationEventType =
  | 'expense_created'
  | 'expense_updated'
  | 'expense_deleted'
  | 'settlement_finalized'
  | 'payment_sent'
  | 'payment_confirmed'
  | 'payment_reversed'
  | 'water_delivery_logged';

export interface NotificationItem {
  id: string;
  roomId: string;
  recipientUserId?: string;
  senderUserId?: string;
  eventType: NotificationEventType;
  title: string;
  body: string;
  data: {
    eventType: NotificationEventType;
    roomId: string;
    url: string;
    [key: string]: any;
  };
  createdAt: string;
  read?: boolean;
}

interface NotificationContextType {
  expoPushToken: string | null;
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  isNotificationsEnabled: boolean;
  markAsRead: (id?: string) => void;
  markAllAsRead: () => void;
  refreshNotifications: () => Promise<void>;
  sendTestNotification: (eventType: NotificationEventType) => Promise<{ success: boolean; error?: string }>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);
const API_URL = 'http://192.168.113.107:8787';

const DEMO_ROOM_ID = 'r3023023-3023-3023-3023-302330233023';

function getInitialDemoNotifications(roomId: string): NotificationItem[] {
  const now = new Date();
  const minsAgo = (m: number) => new Date(now.getTime() - m * 60 * 1000).toISOString();
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600 * 1000).toISOString();

  return [
    {
      id: 'notif-1',
      roomId,
      eventType: 'payment_confirmed',
      title: 'Payment Confirmed! 🎉',
      body: 'Rahul Sharma confirmed payment of ₹7,900 from Sameer Rao.',
      data: {
        eventType: 'payment_confirmed',
        roomId,
        url: '/payment-history',
      },
      createdAt: minsAgo(15),
      read: false,
    },
    {
      id: 'notif-2',
      roomId,
      eventType: 'water_delivery_logged',
      title: 'Water Can Delivered 💧',
      body: 'Aman Verma logged 1 water can delivery (₹40).',
      data: {
        eventType: 'water_delivery_logged',
        roomId,
        url: '/water-delivery',
      },
      createdAt: hoursAgo(2),
      read: false,
    },
    {
      id: 'notif-3',
      roomId,
      eventType: 'expense_created',
      title: 'New Expense Added',
      body: 'Rahul Sharma added Blinkit Groceries: ₹2,450 (₹613/person).',
      data: {
        eventType: 'expense_created',
        roomId,
        url: '/(tabs)/expenses',
      },
      createdAt: hoursAgo(6),
      read: true,
    },
    {
      id: 'notif-4',
      roomId,
      eventType: 'payment_sent',
      title: 'Payment Sent — Awaiting Confirmation',
      body: 'Aman Verma sent payment of ₹4,250 to Rahul Sharma.',
      data: {
        eventType: 'payment_sent',
        roomId,
        url: '/collector-confirmations',
      },
      createdAt: hoursAgo(24),
      read: true,
    },
    {
      id: 'notif-5',
      roomId,
      eventType: 'settlement_finalized',
      title: 'Settlement Finalized 🔒',
      body: 'October 2026 settlement locked (₹31,600 total). Equal share ₹7,900.',
      data: {
        eventType: 'settlement_finalized',
        roomId,
        url: '/statement-detail?period=2026-10',
      },
      createdAt: hoursAgo(48),
      read: true,
    },
  ];
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#2563EB',
        });
      } catch {
        // Channel not supported in this environment
      }
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync().catch(() => null);
    return tokenData?.data || null;
  } catch (err) {
    console.log('[NotificationContext] Push registration error:', err);
    return null;
  }
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, token } = useAuth();
  const { room } = useRoom();

  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  const roomId = room?.id || DEMO_ROOM_ID;

  // 1. Register push token on device & backend
  useEffect(() => {
    let isMounted = true;

    async function initPush() {
      let pushToken = await registerForPushNotificationsAsync();
      if (!pushToken && user) {
        // Fallback simulated token for emulator / offline testing
        pushToken = `ExponentPushToken[mock-${user.id.slice(0, 8)}]`;
      }

      if (isMounted && pushToken) {
        setExpoPushToken(pushToken);

        // Send token to backend API if authenticated
        if (token) {
          fetch(`${API_URL}/api/notifications/token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ token: pushToken }),
          }).catch((err) => console.log('[NotificationContext] Token sync error:', err));
        }
      }
    }

    initPush();

    return () => {
      isMounted = false;
    };
  }, [user, token]);

  // 2. Set up incoming notification & tap response listeners (Deep Linking)
  useEffect(() => {
    // Foreground notification listener
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      const { title, body, data } = notification.request.content;
      const notifId = (data?.id as string) || (data?.notificationId as string) || notification.request.identifier;
      const newNotif: NotificationItem = {
        id: notifId,
        roomId: (data?.roomId as string) || roomId,
        eventType: (data?.eventType as NotificationEventType) || 'expense_created',
        title: title || 'New Notification',
        body: body || '',
        data: (data as any) || { url: '/(tabs)/index' },
        createdAt: new Date().toISOString(),
        read: false,
      };

      setNotifications((prev) => {
        // Prevent duplicate notification entries by id
        if (prev.some((n) => n.id === notifId)) return prev;
        return [newNotif, ...prev];
      });
    });

    // Deep link tap listener
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      const url = data?.url;
      if (url && typeof url === 'string') {
        router.push(url as any);
      }
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [roomId, router]);

  // 3. Load notifications history from backend
  const refreshNotifications = useCallback(async () => {
    if (!token) {
      setNotifications(getInitialDemoNotifications(roomId));
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.notifications) && data.notifications.length > 0) {
        setNotifications(data.notifications);
      } else {
        setNotifications((prev) => (prev.length > 0 ? prev : getInitialDemoNotifications(roomId)));
      }
    } catch {
      setNotifications((prev) => (prev.length > 0 ? prev : getInitialDemoNotifications(roomId)));
    } finally {
      setIsLoading(false);
    }
  }, [token, roomId]);

  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  const markAsRead = useCallback((id?: string) => {
    setNotifications((prev) =>
      prev.map((n) => (id === undefined || n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const sendTestNotification = useCallback(
    async (eventType: NotificationEventType): Promise<{ success: boolean; error?: string }> => {
      if (!token) return { success: false, error: 'Not authenticated' };

      try {
        const res = await fetch(`${API_URL}/api/rooms/${roomId}/notifications/test`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            eventType,
            includeSender: true,
          }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          // If room notifications are stopped, do not show or schedule local notification
          if (data.suppressed) {
            return {
              success: false,
              error: 'Notifications are stopped in Room Settings. Turn them on in Room Settings to receive alerts.',
            };
          }

          const notif = data.notifications?.[0];
          const notifId = notif?.id || crypto.randomUUID();

          // Add to local state ONCE with unique ID
          if (notif) {
            setNotifications((prev) => {
              if (prev.some((n) => n.id === notifId)) return prev;
              return [{ ...notif, id: notifId }, ...prev];
            });
          }

          // Trigger local in-app presentation test passing the same ID to prevent duplication
          Notifications.scheduleNotificationAsync({
            content: {
              title: notif?.title || 'Test Notification',
              body: notif?.body || 'Testing push notification reception',
              data: {
                ...(notif?.data || {}),
                id: notifId,
                notificationId: notifId,
              },
            },
            trigger: null,
          }).catch(() => null);

          return { success: true };
        }
        return { success: false, error: data.error || 'Failed to dispatch test notification' };
      } catch (err: any) {
        return { success: false, error: err.message || 'Network error' };
      }
    },
    [token, roomId]
  );

  const unreadCount = notifications.filter((n) => !n.read).length;
  const isNotificationsEnabled = room?.notificationsEnabled ?? true;

  return (
    <NotificationContext.Provider
      value={{
        expoPushToken,
        notifications,
        unreadCount,
        isLoading,
        isNotificationsEnabled,
        markAsRead,
        markAllAsRead,
        refreshNotifications,
        sendTestNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
