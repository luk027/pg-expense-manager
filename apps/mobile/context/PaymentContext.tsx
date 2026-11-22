import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useRoom } from './RoomContext';
import { useSettlement } from './SettlementContext';

export interface PaymentItem {
  id: string;
  roomId: string;
  settlementId: string;
  payerUserId: string;
  payerName: string;
  collectorUserId: string;
  collectorName: string;
  amountPaise: number;
  method: 'upi' | 'cash';
  status: 'sent' | 'confirmed' | 'cancelled' | 'reversed';
  sentAt: string;
  confirmedAt?: string | null;
  cancelledAt?: string | null;
  reversedAt?: string | null;
  reversalReason?: string | null;
  idempotencyKey: string;
}

export interface LandlordPaymentItem {
  id: string;
  roomId: string;
  settlementId: string;
  paidByUserId: string;
  paidByName: string;
  amountPaise: number;
  method: 'upi' | 'cash';
  paidAt: string;
}

interface PaymentContextType {
  payments: PaymentItem[];
  landlordPayments: LandlordPaymentItem[];
  pendingConfirmations: PaymentItem[];
  isLoading: boolean;
  refreshPayments: () => Promise<void>;
  sendPayment: (input: { settlementId: string; amountPaise: number; method: 'upi' | 'cash' }) => Promise<{ success: boolean; error?: string }>;
  confirmPayment: (paymentId: string) => Promise<{ success: boolean; error?: string }>;
  cancelPayment: (paymentId: string) => Promise<{ success: boolean; error?: string }>;
  reversePayment: (paymentId: string, reason: string) => Promise<{ success: boolean; error?: string }>;
  recordLandlordPayment: (input: { settlementId: string; amountPaise: number; method: 'upi' | 'cash'; paidAt?: string }) => Promise<{ success: boolean; error?: string }>;
}

const PaymentContext = createContext<PaymentContextType | undefined>(undefined);
const API_URL = 'http://192.168.113.107:8787';

const DEMO_ROOM_ID = 'r3023023-3023-3023-3023-302330233023';
const RAHUL_ID = 'u1111111-1111-1111-1111-111111111111';
const AMAN_ID = 'u2222222-2222-2222-2222-222222222222';
const KUNAL_ID = 'u3333333-3333-3333-3333-333333333333';
const SAMEER_ID = 'u4444444-4444-4444-4444-444444444444';
const OCT_SETTLEMENT_ID = 'set-2026-10-flat302';

function getInitialDemoPayments(roomId: string): { payments: PaymentItem[]; landlordPayments: LandlordPaymentItem[] } {
  const octDate = '2026-10-31T20:30:00.000Z';
  return {
    payments: [
      {
        id: 'pay-oct-rahul',
        roomId,
        settlementId: OCT_SETTLEMENT_ID,
        payerUserId: RAHUL_ID,
        payerName: 'Rahul Sharma',
        collectorUserId: RAHUL_ID,
        collectorName: 'Rahul Sharma',
        amountPaise: 430000,
        method: 'upi',
        status: 'confirmed',
        sentAt: octDate,
        confirmedAt: octDate,
        idempotencyKey: 'idem-oct-rahul',
      },
      {
        id: 'pay-oct-aman',
        roomId,
        settlementId: OCT_SETTLEMENT_ID,
        payerUserId: AMAN_ID,
        payerName: 'Aman Verma',
        collectorUserId: RAHUL_ID,
        collectorName: 'Rahul Sharma',
        amountPaise: 790000,
        method: 'upi',
        status: 'confirmed',
        sentAt: octDate,
        confirmedAt: octDate,
        idempotencyKey: 'idem-oct-aman',
      },
      {
        id: 'pay-oct-kunal',
        roomId,
        settlementId: OCT_SETTLEMENT_ID,
        payerUserId: KUNAL_ID,
        payerName: 'Kunal Patel',
        collectorUserId: RAHUL_ID,
        collectorName: 'Rahul Sharma',
        amountPaise: 790000,
        method: 'upi',
        status: 'confirmed',
        sentAt: octDate,
        confirmedAt: octDate,
        idempotencyKey: 'idem-oct-kunal',
      },
      {
        id: 'pay-oct-sameer',
        roomId,
        settlementId: OCT_SETTLEMENT_ID,
        payerUserId: SAMEER_ID,
        payerName: 'Sameer Rao',
        collectorUserId: RAHUL_ID,
        collectorName: 'Rahul Sharma',
        amountPaise: 790000,
        method: 'cash',
        status: 'confirmed',
        sentAt: octDate,
        confirmedAt: octDate,
        idempotencyKey: 'idem-oct-sameer',
      },
    ],
    landlordPayments: [
      {
        id: 'lp-oct-landlord',
        roomId,
        settlementId: OCT_SETTLEMENT_ID,
        paidByUserId: RAHUL_ID,
        paidByName: 'Rahul Sharma',
        amountPaise: 2800000,
        method: 'upi',
        paidAt: octDate,
      },
    ],
  };
}

export function PaymentProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const { room, activeMembers } = useRoom();
  const { refreshSettlement, selectedPeriod } = useSettlement();

  const [paymentsList, setPaymentsList] = useState<PaymentItem[]>([]);
  const [landlordPaymentsList, setLandlordPaymentsList] = useState<LandlordPaymentItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (room?.id) {
      const demo = getInitialDemoPayments(room.id);
      setPaymentsList(demo.payments);
      setLandlordPaymentsList(demo.landlordPayments);
    }
  }, [room?.id]);

  const refreshPayments = useCallback(async () => {
    if (!room?.id) {
      setIsLoading(false);
      return;
    }

    if (token) {
      try {
        const res = await fetch(`${API_URL}/api/rooms/${room.id}/payments`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.payments) setPaymentsList(data.payments);
          if (data.landlordPayments) setLandlordPaymentsList(data.landlordPayments);
        }
      } catch {
        // Keep cached state
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, [token, room?.id]);

  useEffect(() => {
    refreshPayments();
  }, [refreshPayments]);

  const pendingConfirmations = useMemo(() => {
    return paymentsList.filter((p) => p.status === 'sent');
  }, [paymentsList]);

  const sendPayment = async (input: { settlementId: string; amountPaise: number; method: 'upi' | 'cash' }) => {
    if (!room?.id) return { success: false, error: 'No room' };

    const idempotencyKey = `idem-${user?.id}-${Date.now()}`;

    if (token) {
      try {
        const res = await fetch(`${API_URL}/api/rooms/${room.id}/payments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ ...input, idempotencyKey }),
        });

        const data = await res.json();
        if (res.ok) {
          await refreshPayments();
          await refreshSettlement();
          return { success: true };
        } else {
          return { success: false, error: data.error || 'Failed to submit payment' };
        }
      } catch {
        // Fall through to offline simulation
      }
    }

    // Offline simulation
    const isCollector = user?.id === room.collectorId;
    const now = new Date().toISOString();
    const newPayment: PaymentItem = {
      id: `pay-local-${Date.now()}`,
      roomId: room.id,
      settlementId: input.settlementId,
      payerUserId: user?.id || 'u2222222-2222-2222-2222-222222222222',
      payerName: user?.name || 'Aman Verma',
      collectorUserId: room.collectorId,
      collectorName: activeMembers.find((m) => m.userId === room.collectorId)?.name || 'Rent Collector',
      amountPaise: input.amountPaise,
      method: input.method,
      status: isCollector ? 'confirmed' : 'sent',
      sentAt: now,
      confirmedAt: isCollector ? now : null,
      idempotencyKey,
    };

    setPaymentsList((prev) => [newPayment, ...prev]);
    return { success: true };
  };

  const confirmPayment = async (paymentId: string) => {
    if (!room?.id) return { success: false, error: 'No room' };

    if (token) {
      try {
        const res = await fetch(`${API_URL}/api/rooms/${room.id}/payments/${paymentId}/confirm`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          await refreshPayments();
          await refreshSettlement();
          return { success: true };
        }
      } catch {
        // Offline fallback
      }
    }

    setPaymentsList((prev) =>
      prev.map((p) => (p.id === paymentId ? { ...p, status: 'confirmed', confirmedAt: new Date().toISOString() } : p))
    );
    return { success: true };
  };

  const cancelPayment = async (paymentId: string) => {
    if (!room?.id) return { success: false, error: 'No room' };

    if (token) {
      try {
        const res = await fetch(`${API_URL}/api/rooms/${room.id}/payments/${paymentId}/cancel`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          await refreshPayments();
          return { success: true };
        }
      } catch {
        // Offline fallback
      }
    }

    setPaymentsList((prev) =>
      prev.map((p) => (p.id === paymentId ? { ...p, status: 'cancelled', cancelledAt: new Date().toISOString() } : p))
    );
    return { success: true };
  };

  const reversePayment = async (paymentId: string, reason: string) => {
    if (!room?.id) return { success: false, error: 'No room' };

    if (token) {
      try {
        const res = await fetch(`${API_URL}/api/rooms/${room.id}/payments/${paymentId}/reverse`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reason }),
        });

        if (res.ok) {
          await refreshPayments();
          await refreshSettlement();
          return { success: true };
        }
      } catch {
        // Offline fallback
      }
    }

    setPaymentsList((prev) =>
      prev.map((p) =>
        p.id === paymentId
          ? { ...p, status: 'reversed', reversedAt: new Date().toISOString(), reversalReason: reason }
          : p
      )
    );
    return { success: true };
  };

  const recordLandlordPayment = async (input: { settlementId: string; amountPaise: number; method: 'upi' | 'cash'; paidAt?: string }) => {
    if (!room?.id) return { success: false, error: 'No room' };

    if (token) {
      try {
        const res = await fetch(`${API_URL}/api/rooms/${room.id}/landlord-payments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(input),
        });

        if (res.ok) {
          await refreshPayments();
          return { success: true };
        }
      } catch {
        // Offline fallback
      }
    }

    const now = new Date().toISOString();
    const newLp: LandlordPaymentItem = {
      id: `lp-local-${Date.now()}`,
      roomId: room.id,
      settlementId: input.settlementId,
      paidByUserId: user?.id || 'u1111111-1111-1111-1111-111111111111',
      paidByName: user?.name || 'Rahul Sharma',
      amountPaise: input.amountPaise,
      method: input.method,
      paidAt: input.paidAt || now,
    };

    setLandlordPaymentsList((prev) => [newLp, ...prev]);
    return { success: true };
  };

  return (
    <PaymentContext.Provider
      value={{
        payments: paymentsList,
        landlordPayments: landlordPaymentsList,
        pendingConfirmations,
        isLoading,
        refreshPayments,
        sendPayment,
        confirmPayment,
        cancelPayment,
        reversePayment,
        recordLandlordPayment,
      }}
    >
      {children}
    </PaymentContext.Provider>
  );
}

export function usePayments() {
  const context = useContext(PaymentContext);
  if (!context) {
    throw new Error('usePayments must be used within a PaymentProvider');
  }
  return context;
}
