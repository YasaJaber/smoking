// ============================================================
// Auth Store - Zustand Authentication State
// ============================================================

import { create } from 'zustand';
import { getDatabase, runSerialized } from '../db/client';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  hasUsers: () => Promise<boolean>;
  createInitialUsers: (adminPin: string, cashierPin?: string) => Promise<void>;
  login: (pin: string) => Promise<boolean>;
  updatePin: (currentPin: string, newPin: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  hasUsers: async () => {
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM users WHERE is_active = 1'
    );
    return (result?.count || 0) > 0;
  },

  createInitialUsers: async (adminPin: string, cashierPin?: string) => {
    return runSerialized(async () => {
    const pinPattern = /^\d{4}$/;
    if (!pinPattern.test(adminPin)) {
      throw new Error('رمز المدير يجب أن يكون 4 أرقام');
    }
    if (cashierPin && !pinPattern.test(cashierPin)) {
      throw new Error('رمز الكاشير يجب أن يكون 4 أرقام');
    }
    if (cashierPin && cashierPin === adminPin) {
      throw new Error('رمز الكاشير يجب أن يختلف عن رمز المدير');
    }

    const db = await getDatabase();
    const existing = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM users'
    );
    if ((existing?.count || 0) > 0) {
      throw new Error('تم إعداد المستخدمين بالفعل');
    }

    const now = new Date().toISOString();
    await db.execAsync('BEGIN TRANSACTION');
    try {
      await db.runAsync(
        'INSERT INTO users (id, name, pin, role, is_active, created_at) VALUES (?, ?, ?, ?, 1, ?)',
        ['user-admin', 'المدير', adminPin, 'admin', now]
      );

      if (cashierPin) {
        await db.runAsync(
          'INSERT INTO users (id, name, pin, role, is_active, created_at) VALUES (?, ?, ?, ?, 1, ?)',
          ['user-cashier', 'الكاشير', cashierPin, 'cashier', now]
        );
      }

      await db.execAsync('COMMIT');
    } catch (error) {
      await db.execAsync('ROLLBACK');
      throw error;
    }
    });
  },

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

  updatePin: async (currentPin: string, newPin: string) => {
    return runSerialized(async () => {
    const currentUser = get().user;
    if (!currentUser) {
      throw new Error('يجب تسجيل الدخول أولاً');
    }

    const db = await getDatabase();
    const existingUser = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM users WHERE pin = ? AND is_active = 1 AND id <> ?',
      [newPin, currentUser.id]
    );

    if (existingUser) {
      throw new Error('رمز الدخول الجديد مستخدم بالفعل');
    }

    const result = await db.runAsync(
      "UPDATE users SET pin = ? WHERE id = ? AND pin = ? AND is_active = 1",
      [newPin, currentUser.id, currentPin]
    );

    if (result.changes === 0) {
      throw new Error('رمز الدخول الحالي غير صحيح');
    }

    set({
      user: {
        ...currentUser,
        pin: newPin,
      },
    });
    });
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
