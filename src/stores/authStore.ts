// ============================================================
// Auth Store - Zustand Authentication State
// ============================================================

import { create } from 'zustand';
import { getDatabase } from '../db/client';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (pin: string) => {
    set({ isLoading: true, error: null });
    try {
      const db = await getDatabase();
      const user = await db.getFirstAsync<User>(
        'SELECT * FROM users WHERE pin = ? AND is_active = 1',
        [pin]
      );

      if (user) {
        set({
          user: { ...user, is_active: Boolean(user.is_active) },
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        return true;
      } else {
        set({
          isLoading: false,
          error: 'رمز الدخول غير صحيح',
        });
        return false;
      }
    } catch (err) {
      set({
        isLoading: false,
        error: 'حدث خطأ في تسجيل الدخول',
      });
      return false;
    }
  },

  logout: () => {
    set({
      user: null,
      isAuthenticated: false,
      error: null,
    });
  },

  clearError: () => set({ error: null }),
}));
