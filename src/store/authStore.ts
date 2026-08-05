import { create } from 'zustand';
import { StorageManager } from '../utils/storage';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'EMPLOYEE';
  permissions: string[];
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  initialize: () => Promise<void>;
  login: (user: UserProfile, token: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => {
  return {
    token: null,
    refreshToken: null,
    user: null,
    isAuthenticated: false,
    isInitializing: true,

    initialize: async () => {
      try {
        const storedToken = await StorageManager.getItem('token');
        const storedRefreshToken = await StorageManager.getItem('refreshToken');
        const storedUser = await StorageManager.getItem('user');

        let parsedUser: UserProfile | null = null;
        if (storedUser) {
          try {
            parsedUser = JSON.parse(storedUser);
          } catch {
            await StorageManager.removeItem('user');
          }
        }

        set({
          token: storedToken,
          refreshToken: storedRefreshToken,
          user: parsedUser,
          isAuthenticated: !!storedToken && !!parsedUser,
          isInitializing: false,
        });
      } catch (err) {
        console.error('Failed to initialize auth store:', err);
        set({ isInitializing: false });
      }
    },

    login: async (user, token, refreshToken) => {
      await StorageManager.setItem('token', token);
      await StorageManager.setItem('refreshToken', refreshToken);
      await StorageManager.setItem('user', JSON.stringify(user));
      set({ user, token, refreshToken, isAuthenticated: true });
    },

    logout: async () => {
      await StorageManager.removeItem('token');
      await StorageManager.removeItem('refreshToken');
      await StorageManager.removeItem('user');
      set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
    },

    hasPermission: (permission: string) => {
      const { user } = get();
      if (!user) return false;
      // Admin has absolute control override
      if (user.role === 'ADMIN') return true;
      return (user.permissions || []).includes(permission);
    },
  };
});
