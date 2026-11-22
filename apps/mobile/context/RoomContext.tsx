import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

export interface RoomInfo {
  id: string;
  name: string;
  adminId: string;
  collectorId: string;
  monthlyRentPaise: number;
  settlementDay: number;
  notificationsEnabled: boolean;
  status: 'active' | 'closed';
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoomMemberItem {
  id: string;
  roomId: string;
  userId: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
  status: 'pending' | 'active' | 'departed';
  joinedAt?: string | null;
  departedAt?: string | null;
  createdAt: string;
}

export interface RoomCategoryItem {
  id: string;
  roomId: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface RentHistoryRecord {
  id: string;
  roomId: string;
  previousRentPaise: number;
  newRentPaise: number;
  effectiveFrom: string;
  reason?: string;
  changedByUserId: string;
  changedByName: string;
  createdAt: string;
}

export interface CloseCheckResult {
  success: boolean;
  canClose: boolean;
  hasUnsettledBalances: boolean;
  unpaidPaise: number;
  unpaidCount: number;
  unpaidMembers: string[];
  unfinalizedExpensesCount: number;
  warning: string;
}

interface RoomContextType {
  room: RoomInfo | null;
  activeMembers: RoomMemberItem[];
  pendingMembers: RoomMemberItem[];
  categories: RoomCategoryItem[];
  isAdmin: boolean;
  isCollector: boolean;
  hasRoom: boolean;
  isLoading: boolean;
  refreshRoom: () => Promise<void>;
  createRoom: (name: string, monthlyRentPaise: number, settlementDay?: number) => Promise<{ success: boolean; error?: string }>;
  updateRoom: (updates: { name?: string; monthlyRentPaise?: number; settlementDay?: number; notificationsEnabled?: boolean }) => Promise<{ success: boolean; error?: string }>;
  generateInvite: () => Promise<{ success: boolean; token?: string; inviteUrl?: string; error?: string }>;
  joinRoom: (token: string) => Promise<{ success: boolean; roomName?: string; error?: string }>;
  approveMember: (memberId: string) => Promise<{ success: boolean; error?: string }>;
  removeMember: (memberId: string) => Promise<{ success: boolean; error?: string }>;
  transferAdmin: (newAdminUserId: string) => Promise<{ success: boolean; error?: string }>;
  assignCollector: (collectorUserId: string) => Promise<{ success: boolean; error?: string }>;
  closeRoom: (force?: boolean) => Promise<{ success: boolean; requiresForce?: boolean; details?: string; error?: string }>;
  reopenRoom: () => Promise<{ success: boolean; error?: string }>;
  checkCloseRoom: () => Promise<{ success: boolean; check?: CloseCheckResult; error?: string }>;
  addCategory: (name: string) => Promise<{ success: boolean; category?: RoomCategoryItem; error?: string }>;
  updateCategory: (categoryId: string, updates: { name?: string; isActive?: boolean }) => Promise<{ success: boolean; error?: string }>;
  deleteCategory: (categoryId: string) => Promise<{ success: boolean; softDisabled?: boolean; message?: string; error?: string }>;
  getRentHistory: () => Promise<{ success: boolean; history?: RentHistoryRecord[]; currentRentPaise?: number; error?: string }>;
  changeRent: (newRentPaise: number, effectiveFrom: string, reason?: string) => Promise<{ success: boolean; rentRecord?: RentHistoryRecord; error?: string }>;
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://pg-expense-manager-api.luqman-gohil-pro.workers.dev';

export function RoomProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();

  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [activeMembers, setActiveMembers] = useState<RoomMemberItem[]>([]);
  const [pendingMembers, setPendingMembers] = useState<RoomMemberItem[]>([]);
  const [categories, setCategories] = useState<RoomCategoryItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCollector, setIsCollector] = useState(false);
  const [hasRoom, setHasRoom] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refreshRoom = useCallback(async () => {
    if (!token || !user) {
      setRoom(null);
      setActiveMembers([]);
      setPendingMembers([]);
      setCategories([]);
      setHasRoom(false);
      setIsAdmin(false);
      setIsCollector(false);
      setIsLoading(false);
      return;
    }

    const applyDemoFallback = () => {
      if (user.email === 'rahul@pgexpense.com' || user.email === 'aman@pgexpense.com') {
        const demoRoom: RoomInfo = {
          id: 'r3023023-3023-3023-3023-302330233023',
          name: 'Flat 302, Green Glen',
          adminId: 'u1111111-1111-1111-1111-111111111111',
          collectorId: 'u1111111-1111-1111-1111-111111111111',
          monthlyRentPaise: 2800000,
          settlementDay: 28,
          notificationsEnabled: true,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setRoom(demoRoom);
        setHasRoom(true);
        setIsAdmin(user.email === 'rahul@pgexpense.com');
        setIsCollector(user.email === 'rahul@pgexpense.com');
        setActiveMembers([
          {
            id: 'm1',
            roomId: demoRoom.id,
            userId: 'u1111111-1111-1111-1111-111111111111',
            name: 'Rahul Sharma',
            email: 'rahul@pgexpense.com',
            role: 'admin',
            status: 'active',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'm2',
            roomId: demoRoom.id,
            userId: 'u2222222-2222-2222-2222-222222222222',
            name: 'Aman Verma',
            email: 'aman@pgexpense.com',
            role: 'member',
            status: 'active',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'm3',
            roomId: demoRoom.id,
            userId: 'u3333333-3333-3333-3333-333333333333',
            name: 'Kunal Patel',
            email: 'kunal@pgexpense.com',
            role: 'member',
            status: 'active',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'm4',
            roomId: demoRoom.id,
            userId: 'u4444444-4444-4444-4444-444444444444',
            name: 'Sameer Rao',
            email: 'sameer@pgexpense.com',
            role: 'member',
            status: 'active',
            createdAt: new Date().toISOString(),
          },
        ]);
        setPendingMembers([
          {
            id: 'm5',
            roomId: demoRoom.id,
            userId: 'u5555555-5555-5555-5555-555555555555',
            name: 'Vikram Singh',
            email: 'vikram@pgexpense.com',
            role: 'member',
            status: 'pending',
            createdAt: new Date().toISOString(),
          },
        ]);
        setCategories([
          { id: 'c1', roomId: demoRoom.id, name: 'Rent', isDefault: true, isActive: true, createdAt: new Date().toISOString() },
          { id: 'c2', roomId: demoRoom.id, name: 'Electricity', isDefault: true, isActive: true, createdAt: new Date().toISOString() },
          { id: 'c3', roomId: demoRoom.id, name: 'Groceries', isDefault: true, isActive: true, createdAt: new Date().toISOString() },
          { id: 'c4', roomId: demoRoom.id, name: 'Water', isDefault: true, isActive: true, createdAt: new Date().toISOString() },
          { id: 'c5', roomId: demoRoom.id, name: 'Wi-Fi', isDefault: true, isActive: true, createdAt: new Date().toISOString() },
        ]);
        return true;
      }
      return false;
    };

    try {
      const res = await fetch(`${API_URL}/api/rooms/current`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.hasRoom && data.room) {
          setRoom(data.room);
          setActiveMembers(data.activeMembers || []);
          setPendingMembers(data.pendingMembers || []);
          setCategories(data.categories || []);
          setHasRoom(true);
          setIsAdmin(data.isAdmin);
          setIsCollector(data.isCollector);
        } else {
          // If server says no room, but it's a demo account, apply fallback
          if (!applyDemoFallback()) {
            setHasRoom(false);
            setRoom(null);
          }
        }
      } else {
        // HTTP error (e.g. 401 or server offline)
        applyDemoFallback();
      }
    } catch (err) {
      console.warn('Could not fetch room from server, using demo room fallback', err);
      applyDemoFallback();
    } finally {
      setIsLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    refreshRoom();
  }, [refreshRoom]);

  const createRoom = async (name: string, monthlyRentPaise: number, settlementDay = 28) => {
    if (!token) return { success: false, error: 'Not authenticated' };
    try {
      const res = await fetch(`${API_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, monthlyRentPaise, settlementDay }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Failed to create room' };
      await refreshRoom();
      return { success: true };
    } catch {
      return { success: false, error: 'Network error creating room' };
    }
  };

  const updateRoom = async (updates: { name?: string; monthlyRentPaise?: number; settlementDay?: number; notificationsEnabled?: boolean }) => {
    if (!token || !room) return { success: false, error: 'Not authenticated' };
    try {
      // Optimistically apply updates to local state
      setRoom((prev) => (prev ? { ...prev, ...updates } : null));

      const res = await fetch(`${API_URL}/api/rooms/${room.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) {
        await refreshRoom();
        return { success: false, error: data.error || 'Failed to update room' };
      }
      if (data.room) {
        setRoom(data.room);
      }
      await refreshRoom();
      return { success: true };
    } catch {
      await refreshRoom();
      return { success: false, error: 'Network error updating room' };
    }
  };

  const generateInvite = async () => {
    if (!token || !room) return { success: false, error: 'Not authenticated' };
    try {
      const res = await fetch(`${API_URL}/api/rooms/${room.id}/invite`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Failed to generate invitation' };
      return { success: true, token: data.token, inviteUrl: data.inviteUrl };
    } catch {
      return { success: false, error: 'Network error generating invite' };
    }
  };

  const joinRoom = async (inviteToken: string) => {
    if (!token) return { success: false, error: 'Not authenticated' };
    try {
      const res = await fetch(`${API_URL}/api/rooms/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ token: inviteToken.trim() }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Failed to join room' };
      await refreshRoom();
      return { success: true, roomName: data.roomName };
    } catch {
      return { success: false, error: 'Network error joining room' };
    }
  };

  const approveMember = async (memberId: string) => {
    if (!token || !room) return { success: false, error: 'Not authenticated' };
    try {
      const res = await fetch(`${API_URL}/api/rooms/${room.id}/members/${memberId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Failed to approve member' };
      await refreshRoom();
      return { success: true };
    } catch {
      return { success: false, error: 'Network error approving member' };
    }
  };

  const removeMember = async (memberId: string) => {
    if (!token || !room) return { success: false, error: 'Not authenticated' };
    try {
      const res = await fetch(`${API_URL}/api/rooms/${room.id}/members/${memberId}/remove`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Failed to remove member' };
      await refreshRoom();
      return { success: true };
    } catch {
      return { success: false, error: 'Network error removing member' };
    }
  };

  const transferAdmin = async (newAdminUserId: string) => {
    if (!token || !room) return { success: false, error: 'Not authenticated' };
    try {
      const res = await fetch(`${API_URL}/api/rooms/${room.id}/transfer-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newAdminUserId }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Failed to transfer admin' };
      await refreshRoom();
      return { success: true };
    } catch {
      return { success: false, error: 'Network error transferring admin' };
    }
  };

  const assignCollector = async (collectorUserId: string) => {
    if (!token || !room) return { success: false, error: 'Not authenticated' };
    try {
      const res = await fetch(`${API_URL}/api/rooms/${room.id}/collector`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ collectorUserId }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Failed to assign collector' };
      await refreshRoom();
      return { success: true };
    } catch {
      return { success: false, error: 'Network error assigning collector' };
    }
  };

  const closeRoom = async (force = false) => {
    if (!token || !room) return { success: false, error: 'Not authenticated' };
    try {
      const res = await fetch(`${API_URL}/api/rooms/${room.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (res.status === 409 && data.requiresForce) {
        return { success: false, requiresForce: true, details: data.details, error: data.error };
      }
      if (!res.ok) return { success: false, error: data.error || 'Failed to close room' };
      await refreshRoom();
      return { success: true };
    } catch {
      return { success: false, error: 'Network error closing room' };
    }
  };

  const reopenRoom = async () => {
    if (!token || !room) return { success: false, error: 'Not authenticated' };
    try {
      const res = await fetch(`${API_URL}/api/rooms/${room.id}/reopen`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Failed to reopen room' };
      await refreshRoom();
      return { success: true };
    } catch {
      return { success: false, error: 'Network error reopening room' };
    }
  };

  const checkCloseRoom = async () => {
    if (!token || !room) return { success: false, error: 'Not authenticated' };
    try {
      const res = await fetch(`${API_URL}/api/rooms/${room.id}/close-check`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Failed to check closure conditions' };
      return { success: true, check: data };
    } catch {
      return { success: false, error: 'Network error checking closure status' };
    }
  };

  const addCategory = async (name: string) => {
    if (!token || !room) return { success: false, error: 'Not authenticated' };
    try {
      const res = await fetch(`${API_URL}/api/rooms/${room.id}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Failed to add category' };
      await refreshRoom();
      return { success: true, category: data.category };
    } catch {
      return { success: false, error: 'Network error adding category' };
    }
  };

  const updateCategory = async (categoryId: string, updates: { name?: string; isActive?: boolean }) => {
    if (!token || !room) return { success: false, error: 'Not authenticated' };
    try {
      const res = await fetch(`${API_URL}/api/rooms/${room.id}/categories/${categoryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Failed to update category' };
      await refreshRoom();
      return { success: true };
    } catch {
      return { success: false, error: 'Network error updating category' };
    }
  };

  const deleteCategory = async (categoryId: string) => {
    if (!token || !room) return { success: false, error: 'Not authenticated' };
    try {
      const res = await fetch(`${API_URL}/api/rooms/${room.id}/categories/${categoryId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Failed to delete category' };
      await refreshRoom();
      return { success: true, softDisabled: data.softDisabled, message: data.message };
    } catch {
      return { success: false, error: 'Network error deleting category' };
    }
  };

  const getRentHistory = async () => {
    if (!token || !room) return { success: false, error: 'Not authenticated' };
    try {
      const res = await fetch(`${API_URL}/api/rooms/${room.id}/rent/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Failed to fetch rent history' };
      return { success: true, history: data.history || [], currentRentPaise: data.currentRentPaise };
    } catch {
      return { success: false, error: 'Network error fetching rent history' };
    }
  };

  const changeRent = async (newRentPaise: number, effectiveFrom: string, reason?: string) => {
    if (!token || !room) return { success: false, error: 'Not authenticated' };
    try {
      const res = await fetch(`${API_URL}/api/rooms/${room.id}/rent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newRentPaise, effectiveFrom, reason: reason?.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Failed to update rent' };
      await refreshRoom();
      return { success: true, rentRecord: data.rentRecord };
    } catch {
      return { success: false, error: 'Network error updating rent' };
    }
  };

  return (
    <RoomContext.Provider
      value={{
        room,
        activeMembers,
        pendingMembers,
        categories,
        isAdmin,
        isCollector,
        hasRoom,
        isLoading,
        refreshRoom,
        createRoom,
        updateRoom,
        generateInvite,
        joinRoom,
        approveMember,
        removeMember,
        transferAdmin,
        assignCollector,
        closeRoom,
        reopenRoom,
        checkCloseRoom,
        addCategory,
        updateCategory,
        deleteCategory,
        getRentHistory,
        changeRent,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
}

export function useRoom() {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRoom must be used within a RoomProvider');
  }
  return context;
}
