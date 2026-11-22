import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useRoom } from './RoomContext';

export interface WaterDeliveryItem {
  id: string;
  roomId: string;
  deliveryDate: string; // YYYY-MM-DD
  deliveryTime: string; // HH:MM
  pricePaise: number;
  recordedByUserId: string;
  recordedByName: string;
  expensePeriod: string; // YYYY-MM
  idempotencyKey: string;
}

export interface ServiceConfigItem {
  waterPricePaise: number;
  cleanerPricePaise: number;
}

interface WaterServiceContextType {
  waterDeliveries: WaterDeliveryItem[];
  serviceConfig: ServiceConfigItem;
  selectedPeriod: string;
  setSelectedPeriod: (period: string) => void;
  isLoading: boolean;
  lastAddedDelivery: WaterDeliveryItem | null;
  undoSecondsLeft: number;
  recordQuickDelivery: () => Promise<{ success: boolean; error?: string }>;
  undoLastDelivery: () => Promise<{ success: boolean; error?: string }>;
  recordBackdatedDelivery: (input: {
    deliveryDate: string;
    deliveryTime?: string;
    count?: number;
  }) => Promise<{ success: boolean; error?: string }>;
  deleteDelivery: (deliveryId: string) => Promise<{ success: boolean; error?: string }>;
  updateServicePrice: (input: {
    serviceType: 'water' | 'cleaner';
    pricePaise: number;
    effectiveFrom: string;
  }) => Promise<{ success: boolean; error?: string }>;
  refreshDeliveries: () => Promise<void>;
}

const WaterServiceContext = createContext<WaterServiceContextType | undefined>(undefined);
const API_URL = 'http://192.168.113.107:8787';

const DEMO_ROOM_ID = 'r3023023-3023-3023-3023-302330233023';
const RAHUL_ID = 'u1111111-1111-1111-1111-111111111111';
const AMAN_ID = 'u2222222-2222-2222-2222-222222222222';

// Pre-seeded local cache for offline/demo reliability
const initialDemoDeliveries: WaterDeliveryItem[] = [
  // November
  { id: 'wd-nov-9', roomId: DEMO_ROOM_ID, deliveryDate: '2026-11-19', deliveryTime: '11:15', pricePaise: 4000, recordedByUserId: RAHUL_ID, recordedByName: 'Rahul Sharma', expensePeriod: '2026-11', idempotencyKey: 'idem-nov-9' },
  { id: 'wd-nov-8', roomId: DEMO_ROOM_ID, deliveryDate: '2026-11-16', deliveryTime: '09:00', pricePaise: 4000, recordedByUserId: AMAN_ID, recordedByName: 'Aman Verma', expensePeriod: '2026-11', idempotencyKey: 'idem-nov-8' },
  { id: 'wd-nov-7', roomId: DEMO_ROOM_ID, deliveryDate: '2026-11-13', deliveryTime: '10:00', pricePaise: 4000, recordedByUserId: RAHUL_ID, recordedByName: 'Rahul Sharma', expensePeriod: '2026-11', idempotencyKey: 'idem-nov-7' },
  { id: 'wd-nov-6', roomId: DEMO_ROOM_ID, deliveryDate: '2026-11-12', deliveryTime: '18:30', pricePaise: 4000, recordedByUserId: AMAN_ID, recordedByName: 'Aman Verma', expensePeriod: '2026-11', idempotencyKey: 'idem-nov-6' },
  { id: 'wd-nov-5', roomId: DEMO_ROOM_ID, deliveryDate: '2026-11-12', deliveryTime: '09:00', pricePaise: 4000, recordedByUserId: RAHUL_ID, recordedByName: 'Rahul Sharma', expensePeriod: '2026-11', idempotencyKey: 'idem-nov-5' },
  { id: 'wd-nov-4', roomId: DEMO_ROOM_ID, deliveryDate: '2026-11-11', deliveryTime: '09:15', pricePaise: 4000, recordedByUserId: AMAN_ID, recordedByName: 'Aman Verma', expensePeriod: '2026-11', idempotencyKey: 'idem-nov-4' },
  { id: 'wd-nov-3', roomId: DEMO_ROOM_ID, deliveryDate: '2026-11-08', deliveryTime: '08:45', pricePaise: 4000, recordedByUserId: RAHUL_ID, recordedByName: 'Rahul Sharma', expensePeriod: '2026-11', idempotencyKey: 'idem-nov-3' },
  { id: 'wd-nov-2', roomId: DEMO_ROOM_ID, deliveryDate: '2026-11-05', deliveryTime: '10:30', pricePaise: 4000, recordedByUserId: AMAN_ID, recordedByName: 'Aman Verma', expensePeriod: '2026-11', idempotencyKey: 'idem-nov-2' },
  { id: 'wd-nov-1', roomId: DEMO_ROOM_ID, deliveryDate: '2026-11-02', deliveryTime: '09:00', pricePaise: 4000, recordedByUserId: RAHUL_ID, recordedByName: 'Rahul Sharma', expensePeriod: '2026-11', idempotencyKey: 'idem-nov-1' },
  // October
  { id: 'wd-oct-14', roomId: DEMO_ROOM_ID, deliveryDate: '2026-10-30', deliveryTime: '09:00', pricePaise: 4000, recordedByUserId: RAHUL_ID, recordedByName: 'Rahul Sharma', expensePeriod: '2026-10', idempotencyKey: 'idem-oct-14' },
  { id: 'wd-oct-13', roomId: DEMO_ROOM_ID, deliveryDate: '2026-10-28', deliveryTime: '17:00', pricePaise: 4000, recordedByUserId: AMAN_ID, recordedByName: 'Aman Verma', expensePeriod: '2026-10', idempotencyKey: 'idem-oct-13' },
  { id: 'wd-oct-12', roomId: DEMO_ROOM_ID, deliveryDate: '2026-10-28', deliveryTime: '09:30', pricePaise: 4000, recordedByUserId: RAHUL_ID, recordedByName: 'Rahul Sharma', expensePeriod: '2026-10', idempotencyKey: 'idem-oct-12' },
];

export function WaterServiceProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const { room } = useRoom();

  const [deliveriesList, setDeliveriesList] = useState<WaterDeliveryItem[]>(initialDemoDeliveries);
  const [serviceConfig, setServiceConfig] = useState<ServiceConfigItem>({
    waterPricePaise: 4000,
    cleanerPricePaise: 300000,
  });
  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026-11');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Undo Toast state
  const [lastAddedDelivery, setLastAddedDelivery] = useState<WaterDeliveryItem | null>(null);
  const [undoSecondsLeft, setUndoSecondsLeft] = useState<number>(0);

  // Undo countdown timer
  useEffect(() => {
    if (undoSecondsLeft <= 0) {
      if (lastAddedDelivery) setLastAddedDelivery(null);
      return;
    }

    const timer = setInterval(() => {
      setUndoSecondsLeft((prev) => Math.max(prev - 1, 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [undoSecondsLeft, lastAddedDelivery]);

  const refreshDeliveries = useCallback(async () => {
    if (!room?.id) {
      setIsLoading(false);
      return;
    }

    if (token) {
      try {
        const [delivRes, configRes] = await Promise.all([
          fetch(`${API_URL}/api/rooms/${room.id}/water-deliveries?period=${selectedPeriod}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_URL}/api/rooms/${room.id}/services/configs`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (delivRes.ok) {
          const dData = await delivRes.json();
          if (dData.deliveries) {
            setDeliveriesList(dData.deliveries);
          }
        }

        if (configRes.ok) {
          const cData = await configRes.json();
          if (cData.activePrices) {
            setServiceConfig(cData.activePrices);
          }
        }
      } catch {
        // Fall back to cached local state
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, [token, room?.id, selectedPeriod]);

  useEffect(() => {
    refreshDeliveries();
  }, [refreshDeliveries]);

  // Filter deliveries by selected period
  const filteredDeliveries = useMemo(() => {
    return deliveriesList.filter((d) => d.expensePeriod === selectedPeriod);
  }, [deliveriesList, selectedPeriod]);

  // Quick-Tap 1-Touch Delivery Recording with 5-Second Undo window
  const recordQuickDelivery = async () => {
    if (!room?.id) return { success: false, error: 'No room found' };

    const now = new Date();
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffsetMs);
    const deliveryDate = istDate.toISOString().substring(0, 10);
    const deliveryTime = istDate.toISOString().substring(11, 16);
    const idempotencyKey = `idem-qt-${user?.id}-${Date.now()}`;

    const newDelivery: WaterDeliveryItem = {
      id: `wd-local-${Date.now()}`,
      roomId: room.id,
      deliveryDate,
      deliveryTime,
      pricePaise: serviceConfig.waterPricePaise,
      recordedByUserId: user?.id || 'u1111111-1111-1111-1111-111111111111',
      recordedByName: user?.name || 'Rahul Sharma',
      expensePeriod: deliveryDate.substring(0, 7),
      idempotencyKey,
    };

    // Optimistic local update
    setDeliveriesList((prev) => [newDelivery, ...prev]);
    setLastAddedDelivery(newDelivery);
    setUndoSecondsLeft(5);

    if (token) {
      try {
        const res = await fetch(`${API_URL}/api/rooms/${room.id}/water-deliveries`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            deliveryDate,
            deliveryTime,
            idempotencyKey,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.delivery) {
            setLastAddedDelivery(data.delivery);
            setDeliveriesList((prev) => [data.delivery, ...prev.filter((d) => d.id !== newDelivery.id)]);
          }
          return { success: true };
        }
      } catch {
        // Optimistic offline success
      }
    }

    return { success: true };
  };

  // Undo Last Added Delivery (called within undo countdown)
  const undoLastDelivery = async () => {
    if (!lastAddedDelivery || !room?.id) return { success: false };

    const targetId = lastAddedDelivery.id;
    setDeliveriesList((prev) => prev.filter((d) => d.id !== targetId));
    setLastAddedDelivery(null);
    setUndoSecondsLeft(0);

    if (token) {
      try {
        await fetch(`${API_URL}/api/rooms/${room.id}/water-deliveries/${targetId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Fallback
      }
    }

    return { success: true };
  };

  // Record Backdated or Multiple Deliveries
  const recordBackdatedDelivery = async (input: {
    deliveryDate: string;
    deliveryTime?: string;
    count?: number;
  }) => {
    if (!room?.id) return { success: false, error: 'No room found' };

    const count = input.count || 1;
    const time = input.deliveryTime || '10:00';
    const idempotencyKey = `idem-backdate-${user?.id}-${Date.now()}`;

    const createdItems: WaterDeliveryItem[] = [];
    for (let i = 0; i < count; i++) {
      createdItems.push({
        id: `wd-bd-${Date.now()}-${i}`,
        roomId: room.id,
        deliveryDate: input.deliveryDate,
        deliveryTime: time,
        pricePaise: serviceConfig.waterPricePaise,
        recordedByUserId: user?.id || 'u1111111-1111-1111-1111-111111111111',
        recordedByName: user?.name || 'Rahul Sharma',
        expensePeriod: input.deliveryDate.substring(0, 7),
        idempotencyKey: `${idempotencyKey}-${i}`,
      });
    }

    setDeliveriesList((prev) => [...createdItems, ...prev]);

    if (token) {
      try {
        if (count === 1) {
          await fetch(`${API_URL}/api/rooms/${room.id}/water-deliveries`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              deliveryDate: input.deliveryDate,
              deliveryTime: time,
              idempotencyKey,
            }),
          });
        } else {
          const entries = createdItems.map((item) => ({
            deliveryDate: item.deliveryDate,
            deliveryTime: item.deliveryTime,
          }));
          await fetch(`${API_URL}/api/rooms/${room.id}/water-deliveries/bulk`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              entries,
              idempotencyKey,
            }),
          });
        }
        await refreshDeliveries();
      } catch {
        // Optimistic offline success
      }
    }

    return { success: true };
  };

  // Delete water delivery
  const deleteDelivery = async (deliveryId: string) => {
    if (!room?.id) return { success: false, error: 'No room found' };

    setDeliveriesList((prev) => prev.filter((d) => d.id !== deliveryId));

    if (token) {
      try {
        await fetch(`${API_URL}/api/rooms/${room.id}/water-deliveries/${deliveryId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Fallback
      }
    }

    return { success: true };
  };

  // Admin update service price
  const updateServicePrice = async (input: {
    serviceType: 'water' | 'cleaner';
    pricePaise: number;
    effectiveFrom: string;
  }) => {
    if (!room?.id) return { success: false, error: 'No room found' };

    setServiceConfig((prev) => ({
      ...prev,
      [input.serviceType === 'water' ? 'waterPricePaise' : 'cleanerPricePaise']: input.pricePaise,
    }));

    if (token) {
      try {
        const res = await fetch(`${API_URL}/api/rooms/${room.id}/services/configs`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(input),
        });

        if (res.ok) {
          await refreshDeliveries();
          return { success: true };
        } else {
          const data = await res.json();
          return { success: false, error: data.error || 'Failed to update service price' };
        }
      } catch {
        // Fallback
      }
    }

    return { success: true };
  };

  return (
    <WaterServiceContext.Provider
      value={{
        waterDeliveries: filteredDeliveries,
        serviceConfig,
        selectedPeriod,
        setSelectedPeriod,
        isLoading,
        lastAddedDelivery,
        undoSecondsLeft,
        recordQuickDelivery,
        undoLastDelivery,
        recordBackdatedDelivery,
        deleteDelivery,
        updateServicePrice,
        refreshDeliveries,
      }}
    >
      {children}
    </WaterServiceContext.Provider>
  );
}

export function useWaterService() {
  const context = useContext(WaterServiceContext);
  if (!context) {
    throw new Error('useWaterService must be used within a WaterServiceProvider');
  }
  return context;
}
