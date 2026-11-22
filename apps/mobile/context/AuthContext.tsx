import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = '@pg_auth_token';
const USER_KEY = '@pg_auth_user';

const safeSetItem = async (key: string, value: string) => {
  try {
    await AsyncStorage.setItem(key, value);
  } catch (e) {
    console.warn(`[Storage] Failed to persist ${key}:`, e);
  }
};

const safeRemoveItem = async (key: string) => {
  try {
    await AsyncStorage.removeItem(key);
  } catch (e) {
    console.warn(`[Storage] Failed to remove ${key}:`, e);
  }
};

// Automatically detect host IP or use local default
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://pg-expense-manager-api.luqman-gohil-pro.workers.dev';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore session on app load
  useEffect(() => {
    async function restoreSession() {
      try {
        const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
        const storedUser = await AsyncStorage.getItem(USER_KEY);

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));

          // Silently verify session with API
          try {
            const res = await fetch(`${API_URL}/api/auth/session`, {
              headers: { Authorization: `Bearer ${storedToken}` },
            });
            if (res.ok) {
              const data = await res.json();
              setUser(data.user);
              await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
            }
          } catch {
            // Keep cached user if offline
          }
        }
      } catch (err) {
        console.error('Failed to restore auth session:', err);
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to log in' };
      }

      setToken(data.token);
      setUser(data.user);
      await safeSetItem(TOKEN_KEY, data.token);
      await safeSetItem(USER_KEY, JSON.stringify(data.user));

      return { success: true };
    } catch {
      // Local fallback for testing if API is currently disconnected
      if (
        (email.toLowerCase() === 'rahul@pgexpense.com' || email.toLowerCase() === 'aman@pgexpense.com') &&
        password === 'password123'
      ) {
        const isRahul = email.toLowerCase().includes('rahul');
        const fallbackUser: User = {
          id: isRahul
            ? 'u1111111-1111-1111-1111-111111111111'
            : 'u2222222-2222-2222-2222-222222222222',
          email,
          name: isRahul ? 'Rahul Sharma' : 'Aman Verma',
        };
        const fallbackToken = isRahul ? 'pg_mock_token_offline' : 'pg_mock_token_offline_aman';
        setToken(fallbackToken);
        setUser(fallbackUser);
        await safeSetItem(TOKEN_KEY, fallbackToken);
        await safeSetItem(USER_KEY, JSON.stringify(fallbackUser));
        return { success: true };
      }
      return { success: false, error: 'Network error: could not connect to server' };
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Registration failed' };
      }

      setToken(data.token);
      setUser(data.user);
      await safeSetItem(TOKEN_KEY, data.token);
      await safeSetItem(USER_KEY, JSON.stringify(data.user));

      return { success: true };
    } catch {
      return { success: false, error: 'Network error: could not connect to server' };
    }
  };

  const logout = async () => {
    try {
      if (token) {
        fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    } finally {
      setToken(null);
      setUser(null);
      await safeRemoveItem(TOKEN_KEY);
      await safeRemoveItem(USER_KEY);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
