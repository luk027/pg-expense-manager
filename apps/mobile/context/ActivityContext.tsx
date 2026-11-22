import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useRoom } from './RoomContext';

export type ActivityFilter = 'all' | 'expenses' | 'payments' | 'settlements' | 'water' | 'room';

export interface ActivityItem {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  userEmail?: string;
  action: string;
  entityType: 'expense' | 'payment' | 'settlement' | 'water' | 'room' | 'member';
  title: string;
  description: string;
  details: Record<string, any>;
  deepLink?: string;
  createdAt: string;
}

export interface ActivityPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

interface ActivityContextType {
  activities: ActivityItem[];
  filter: ActivityFilter;
  filterCounts: Record<ActivityFilter, number>;
  isLoading: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  hasMore: boolean;
  selectedActivity: ActivityItem | null;
  setFilter: (f: ActivityFilter) => void;
  setSelectedActivity: (item: ActivityItem | null) => void;
  loadMore: () => Promise<void>;
  refreshActivities: () => Promise<void>;
}

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);
const API_URL = 'http://192.168.113.107:8787';

// Pre-seeded local fallback activities for offline & instantaneous rendering
const initialDemoActivities: ActivityItem[] = [
  // Today (2026-11-20)
  {
    id: 'act-20',
    roomId: 'r3023023-3023-3023-3023-302330233023',
    userId: 'u1111111-1111-1111-1111-111111111111',
    userName: 'Rahul Sharma',
    userEmail: 'rahul@pgexpense.com',
    action: 'water_delivery_recorded',
    entityType: 'water',
    title: 'Logged 1 Water Delivery (₹40)',
    description: 'Rahul Sharma recorded delivery at 11:15 on Today',
    details: { deliveryId: 'wd-nov-9', deliveryDate: '2026-11-20', deliveryTime: '11:15', pricePaise: 4000, recordedBy: 'Rahul Sharma' },
    deepLink: '/water-delivery',
    createdAt: '2026-11-20T11:15:00.000Z',
  },
  {
    id: 'act-19',
    roomId: 'r3023023-3023-3023-3023-302330233023',
    userId: 'u2222222-2222-2222-2222-222222222222',
    userName: 'Aman Verma',
    userEmail: 'aman@pgexpense.com',
    action: 'payment_sent',
    entityType: 'payment',
    title: 'Sent payment of ₹6,312',
    description: 'Aman Verma submitted payment via UPI',
    details: { paymentId: 'pay-nov-aman', settlementId: 'draft-r3023023-2026-11', amountPaise: 631225, method: 'UPI', payer: 'Aman Verma' },
    deepLink: '/collector-confirmations',
    createdAt: '2026-11-20T10:45:00.000Z',
  },
  {
    id: 'act-18',
    roomId: 'r3023023-3023-3023-3023-302330233023',
    userId: 'u1111111-1111-1111-1111-111111111111',
    userName: 'Rahul Sharma',
    userEmail: 'rahul@pgexpense.com',
    action: 'expense_created',
    entityType: 'expense',
    title: "Added expense 'Milk & Eggs' (₹280)",
    description: 'Rahul Sharma paid ₹280 for Milk & Eggs',
    details: { expenseId: 'exp-groceries-3', expenseName: 'Milk & Eggs', amountPaise: 28000, paidBy: 'Rahul Sharma', memberCount: 4 },
    deepLink: '/expense-detail?id=exp-groceries-3',
    createdAt: '2026-11-20T09:30:00.000Z',
  },

  // Yesterday (2026-11-19)
  {
    id: 'act-17',
    roomId: 'r3023023-3023-3023-3023-302330233023',
    userId: 'u2222222-2222-2222-2222-222222222222',
    userName: 'Aman Verma',
    userEmail: 'aman@pgexpense.com',
    action: 'expense_updated',
    entityType: 'expense',
    title: "Updated expense 'Airtel Xstream Fiber (300 Mbps)'",
    description: 'Aman Verma changed amount from ₹1,399 to ₹1,599',
    details: {
      expenseId: 'exp-nov-wifi',
      previousValues: { name: 'Airtel Wi-Fi', amountPaise: 139900 },
      updatedValues: { name: 'Airtel Xstream Fiber (300 Mbps)', amountPaise: 159900 },
    },
    deepLink: '/expense-detail?id=exp-nov-wifi',
    createdAt: '2026-11-19T18:20:00.000Z',
  },
  {
    id: 'act-16',
    roomId: 'r3023023-3023-3023-3023-302330233023',
    userId: 'u1111111-1111-1111-1111-111111111111',
    userName: 'Rahul Sharma',
    userEmail: 'rahul@pgexpense.com',
    action: 'water_delivery_recorded',
    entityType: 'water',
    title: 'Logged 1 Water Delivery (₹40)',
    description: 'Rahul Sharma recorded delivery at 09:00 on Yesterday',
    details: { deliveryId: 'wd-nov-8', deliveryDate: '2026-11-19', deliveryTime: '09:00', pricePaise: 4000, recordedBy: 'Rahul Sharma' },
    deepLink: '/water-delivery',
    createdAt: '2026-11-19T09:00:00.000Z',
  },

  // This Week
  {
    id: 'act-15',
    roomId: 'r3023023-3023-3023-3023-302330233023',
    userId: 'u1111111-1111-1111-1111-111111111111',
    userName: 'Rahul Sharma',
    userEmail: 'rahul@pgexpense.com',
    action: 'collector_assigned',
    entityType: 'room',
    title: 'Assigned Rent Collector',
    description: 'Rahul Sharma was designated as active rent collector',
    details: { collectorName: 'Rahul Sharma' },
    deepLink: '/room-settings',
    createdAt: '2026-11-16T15:00:00.000Z',
  },
  {
    id: 'act-14',
    roomId: 'r3023023-3023-3023-3023-302330233023',
    userId: 'u2222222-2222-2222-2222-222222222222',
    userName: 'Aman Verma',
    userEmail: 'aman@pgexpense.com',
    action: 'expense_created',
    entityType: 'expense',
    title: "Added expense 'Maid & Cook Monthly Salary' (₹6,000)",
    description: 'Aman Verma paid ₹6,000 for Maid & Cook Monthly Salary',
    details: { expenseId: 'exp-maid-cook', expenseName: 'Maid & Cook Monthly Salary', amountPaise: 600000, paidBy: 'Aman Verma', memberCount: 4 },
    deepLink: '/(tabs)/expenses',
    createdAt: '2026-11-15T12:00:00.000Z',
  },
  {
    id: 'act-13',
    roomId: 'r3023023-3023-3023-3023-302330233023',
    userId: 'u1111111-1111-1111-1111-111111111111',
    userName: 'Rahul Sharma',
    userEmail: 'rahul@pgexpense.com',
    action: 'service_price_updated',
    entityType: 'water',
    title: 'Updated water rate to ₹40',
    description: 'Rahul Sharma set new price effective from 2026-11-01',
    details: { serviceType: 'water', pricePaise: 4000, effectiveFrom: '2026-11-01', updatedBy: 'Rahul Sharma' },
    deepLink: '/service-config',
    createdAt: '2026-11-14T11:00:00.000Z',
  },
  {
    id: 'act-12',
    roomId: 'r3023023-3023-3023-3023-302330233023',
    userId: 'u3333333-3333-3333-3333-333333333333',
    userName: 'Kunal Patel',
    userEmail: 'kunal@pgexpense.com',
    action: 'expense_created',
    entityType: 'expense',
    title: "Added expense 'Nature Basket Groceries' (₹3,450)",
    description: 'Kunal Patel paid ₹3,450 for Nature Basket Groceries',
    details: { expenseId: 'exp-groceries-bulk', expenseName: 'Nature Basket Groceries', amountPaise: 345000, paidBy: 'Kunal Patel', memberCount: 4 },
    deepLink: '/(tabs)/expenses',
    createdAt: '2026-11-12T19:30:00.000Z',
  },
  {
    id: 'act-11',
    roomId: 'r3023023-3023-3023-3023-302330233023',
    userId: 'u1111111-1111-1111-1111-111111111111',
    userName: 'Rahul Sharma',
    userEmail: 'rahul@pgexpense.com',
    action: 'water_deliveries_bulk_recorded',
    entityType: 'water',
    title: 'Bulk logged 3 water cans',
    description: 'Rahul Sharma backdated multiple water can deliveries',
    details: { count: 3, recordedBy: 'Rahul Sharma' },
    deepLink: '/water-delivery',
    createdAt: '2026-11-11T10:15:00.000Z',
  },

  // Earlier This Month
  {
    id: 'act-10',
    roomId: 'r3023023-3023-3023-3023-302330233023',
    userId: 'u4444444-4444-4444-4444-444444444444',
    userName: 'Sameer Rao',
    userEmail: 'sameer@pgexpense.com',
    action: 'expense_created',
    entityType: 'expense',
    title: "Added expense 'Cleaning Supplies & Detergent' (₹1,080)",
    description: 'Sameer Rao paid ₹1,080 for Cleaning Supplies & Detergent',
    details: { expenseId: 'exp-cleaner-supplies', expenseName: 'Cleaning Supplies & Detergent', amountPaise: 108000, paidBy: 'Sameer Rao', memberCount: 4 },
    deepLink: '/(tabs)/expenses',
    createdAt: '2026-11-06T14:40:00.000Z',
  },
  {
    id: 'act-9',
    roomId: 'r3023023-3023-3023-3023-302330233023',
    userId: 'u1111111-1111-1111-1111-111111111111',
    userName: 'Rahul Sharma',
    userEmail: 'rahul@pgexpense.com',
    action: 'category_created',
    entityType: 'expense',
    title: "Created category 'Gas Cylinder'",
    description: 'Rahul Sharma created a new expense category',
    details: { categoryName: 'Gas Cylinder' },
    deepLink: '/room-settings',
    createdAt: '2026-11-04T16:00:00.000Z',
  },
  {
    id: 'act-8',
    roomId: 'r3023023-3023-3023-3023-302330233023',
    userId: 'u1111111-1111-1111-1111-111111111111',
    userName: 'Rahul Sharma',
    userEmail: 'rahul@pgexpense.com',
    action: 'invite_generated',
    entityType: 'room',
    title: 'Generated Room Invite',
    description: 'Rahul Sharma created a 7-day shareable invite link',
    details: { token: 'inv-demo-7day-token' },
    deepLink: '/invite-modal',
    createdAt: '2026-11-02T10:00:00.000Z',
  },

  // October 2026
  {
    id: 'act-7',
    roomId: 'r3023023-3023-3023-3023-302330233023',
    userId: 'u1111111-1111-1111-1111-111111111111',
    userName: 'Rahul Sharma',
    userEmail: 'rahul@pgexpense.com',
    action: 'landlord_payment_recorded',
    entityType: 'payment',
    title: 'Recorded Landlord Rent Payout (₹28,000)',
    description: 'Rahul Sharma paid full room rent to landlord via bank_transfer',
    details: { settlementId: 'set-2026-10-flat302', amountPaise: 2800000, method: 'bank_transfer', recordedBy: 'Rahul Sharma' },
    deepLink: '/payment-history',
    createdAt: '2026-10-31T18:00:00.000Z',
  },
  {
    id: 'act-6',
    roomId: 'r3023023-3023-3023-3023-302330233023',
    userId: 'u1111111-1111-1111-1111-111111111111',
    userName: 'Rahul Sharma',
    userEmail: 'rahul@pgexpense.com',
    action: 'payment_confirmed',
    entityType: 'payment',
    title: 'Confirmed payment of ₹7,900',
    description: 'Rahul Sharma confirmed receipt from Kunal Patel',
    details: { paymentId: 'pay-oct-kunal', amountPaise: 790000, payer: 'Kunal Patel', confirmedBy: 'Rahul Sharma' },
    deepLink: '/payment-history',
    createdAt: '2026-10-31T17:15:00.000Z',
  },
  {
    id: 'act-5',
    roomId: 'r3023023-3023-3023-3023-302330233023',
    userId: 'u1111111-1111-1111-1111-111111111111',
    userName: 'Rahul Sharma',
    userEmail: 'rahul@pgexpense.com',
    action: 'payment_confirmed',
    entityType: 'payment',
    title: 'Confirmed payment of ₹7,900',
    description: 'Rahul Sharma confirmed receipt from Aman Verma',
    details: { paymentId: 'pay-oct-aman', amountPaise: 790000, payer: 'Aman Verma', confirmedBy: 'Rahul Sharma' },
    deepLink: '/payment-history',
    createdAt: '2026-10-31T17:00:00.000Z',
  },
  {
    id: 'act-4',
    roomId: 'r3023023-3023-3023-3023-302330233023',
    userId: 'u1111111-1111-1111-1111-111111111111',
    userName: 'Rahul Sharma',
    userEmail: 'rahul@pgexpense.com',
    action: 'payment_confirmed',
    entityType: 'payment',
    title: 'Confirmed payment of ₹7,900',
    description: 'Rahul Sharma confirmed receipt from Sameer Rao',
    details: { paymentId: 'pay-oct-sameer', amountPaise: 790000, payer: 'Sameer Rao', confirmedBy: 'Rahul Sharma' },
    deepLink: '/payment-history',
    createdAt: '2026-10-31T16:50:00.000Z',
  },
  {
    id: 'act-3',
    roomId: 'r3023023-3023-3023-3023-302330233023',
    userId: 'u1111111-1111-1111-1111-111111111111',
    userName: 'Rahul Sharma',
    userEmail: 'rahul@pgexpense.com',
    action: 'settlement_finalized',
    entityType: 'settlement',
    title: 'Finalized Settlement for 2026-10',
    description: 'Locked cycle: Rent ₹28,000 + Expenses ₹3,600 = ₹31,600',
    details: { settlementId: 'set-2026-10-flat302', period: '2026-10', totalRentPaise: 2800000, totalExpensesPaise: 360000, grandTotalPaise: 3160000 },
    deepLink: '/statement-detail',
    createdAt: '2026-10-31T15:30:00.000Z',
  },
  {
    id: 'act-2',
    roomId: 'r3023023-3023-3023-3023-302330233023',
    userId: 'u4444444-4444-4444-4444-444444444444',
    userName: 'Sameer Rao',
    userEmail: 'sameer@pgexpense.com',
    action: 'member_approved',
    entityType: 'member',
    title: 'Approved New Roommate',
    description: 'Sameer Rao joined the flat',
    details: { memberName: 'Sameer Rao' },
    deepLink: '/(tabs)/room',
    createdAt: '2026-10-01T12:00:00.000Z',
  },
  {
    id: 'act-1',
    roomId: 'r3023023-3023-3023-3023-302330233023',
    userId: 'u1111111-1111-1111-1111-111111111111',
    userName: 'Rahul Sharma',
    userEmail: 'rahul@pgexpense.com',
    action: 'room_created',
    entityType: 'room',
    title: "Created room 'Flat 302, Green Glen'",
    description: 'Rahul Sharma established room with rent of ₹28,000/mo',
    details: { name: 'Flat 302, Green Glen', monthlyRentPaise: 2800000 },
    deepLink: '/room-settings',
    createdAt: '2026-10-01T10:00:00.000Z',
  },
];

export const ActivityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const { room } = useRoom();

  const [activities, setActivities] = useState<ActivityItem[]>(initialDemoActivities);
  const [filter, setFilterState] = useState<ActivityFilter>('all');
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);

  const [filterCounts, setFilterCounts] = useState<Record<ActivityFilter, number>>({
    all: initialDemoActivities.length,
    expenses: initialDemoActivities.filter((a) => a.entityType === 'expense').length,
    payments: initialDemoActivities.filter((a) => a.entityType === 'payment').length,
    settlements: initialDemoActivities.filter((a) => a.entityType === 'settlement').length,
    water: initialDemoActivities.filter((a) => a.entityType === 'water').length,
    room: initialDemoActivities.filter((a) => a.entityType === 'room' || a.entityType === 'member').length,
  });

  const roomId = room?.id || 'r3023023-3023-3023-3023-302330233023';

  // Fetch activities from backend
  const fetchActivities = useCallback(
    async (currentFilter: ActivityFilter, pageNum: number, isRefresh: boolean = false) => {
      if (pageNum === 1) {
        if (isRefresh) setIsRefreshing(true);
        else setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const authToken = token || 'pg_mock_token_offline';
        const filterParam = currentFilter !== 'all' ? `&filter=${currentFilter}` : '';
        const res = await fetch(
          `${API_URL}/api/rooms/${roomId}/activity?page=${pageNum}&limit=15${filterParam}`,
          {
            headers: { Authorization: `Bearer ${authToken}` },
          }
        );

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.activities)) {
            if (pageNum === 1) {
              setActivities(data.activities);
            } else {
              setActivities((prev) => {
                const existingIds = new Set(prev.map((item) => item.id));
                const uniqueNew = data.activities.filter((item: ActivityItem) => !existingIds.has(item.id));
                return [...prev, ...uniqueNew];
              });
            }
          }
          if (data.pagination) {
            setHasMore(data.pagination.hasMore);
          }
          if (data.filterCounts) {
            setFilterCounts(data.filterCounts);
          }
        } else {
          // Fallback to local filtering
          filterFallbackLocal(currentFilter, pageNum);
        }
      } catch (err) {
        // Fallback to local filtering
        filterFallbackLocal(currentFilter, pageNum);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
        setIsRefreshing(false);
      }
    },
    [roomId, token]
  );

  const filterFallbackLocal = (f: ActivityFilter, pageNum: number) => {
    let filtered = initialDemoActivities;
    if (f === 'expenses') filtered = initialDemoActivities.filter((a) => a.entityType === 'expense');
    else if (f === 'payments') filtered = initialDemoActivities.filter((a) => a.entityType === 'payment');
    else if (f === 'settlements') filtered = initialDemoActivities.filter((a) => a.entityType === 'settlement');
    else if (f === 'water') filtered = initialDemoActivities.filter((a) => a.entityType === 'water');
    else if (f === 'room') filtered = initialDemoActivities.filter((a) => a.entityType === 'room' || a.entityType === 'member');

    setActivities(filtered);
    setHasMore(false);
    setFilterCounts({
      all: initialDemoActivities.length,
      expenses: initialDemoActivities.filter((a) => a.entityType === 'expense').length,
      payments: initialDemoActivities.filter((a) => a.entityType === 'payment').length,
      settlements: initialDemoActivities.filter((a) => a.entityType === 'settlement').length,
      water: initialDemoActivities.filter((a) => a.entityType === 'water').length,
      room: initialDemoActivities.filter((a) => a.entityType === 'room' || a.entityType === 'member').length,
    });
  };

  // Change filter chip
  const setFilter = useCallback(
    (newFilter: ActivityFilter) => {
      setFilterState(newFilter);
      setPage(1);
      fetchActivities(newFilter, 1);
    },
    [fetchActivities]
  );

  // Load more items for infinite scroll
  const loadMore = useCallback(async () => {
    if (isLoading || isLoadingMore || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchActivities(filter, nextPage);
  }, [filter, hasMore, isLoading, isLoadingMore, page, fetchActivities]);

  // Pull to refresh
  const refreshActivities = useCallback(async () => {
    setPage(1);
    await fetchActivities(filter, 1, true);
  }, [filter, fetchActivities]);

  // Initial load
  useEffect(() => {
    fetchActivities('all', 1);
  }, [fetchActivities]);

  const value = useMemo(
    () => ({
      activities,
      filter,
      filterCounts,
      isLoading,
      isLoadingMore,
      isRefreshing,
      hasMore,
      selectedActivity,
      setFilter,
      setSelectedActivity,
      loadMore,
      refreshActivities,
    }),
    [
      activities,
      filter,
      filterCounts,
      isLoading,
      isLoadingMore,
      isRefreshing,
      hasMore,
      selectedActivity,
      setFilter,
      setSelectedActivity,
      loadMore,
      refreshActivities,
    ]
  );

  return <ActivityContext.Provider value={value}>{children}</ActivityContext.Provider>;
};

export const useActivity = (): ActivityContextType => {
  const context = useContext(ActivityContext);
  if (!context) {
    throw new Error('useActivity must be used within an ActivityProvider');
  }
  return context;
};
