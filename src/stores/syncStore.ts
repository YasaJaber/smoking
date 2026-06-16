// ============================================================
// Sync Store - Zustand state for cloud sync status
// ============================================================

import { create } from 'zustand';
import {
  syncNow,
  isSyncConfigured,
  getPendingChangesCount,
  getLastSyncTime,
} from '../services/syncService';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline' | 'disabled';

interface SyncState {
  status: SyncStatus;
  isOnline: boolean;
  isConfigured: boolean;
  pendingCount: number;
  lastSyncIso: string | null;
  error: string | null;
  // Actions
  setOnline: (online: boolean) => void;
  refreshStatus: () => Promise<void>;
  sync: (silent?: boolean) => Promise<void>;
}

function mapError(message: string): string {
  if (message === 'NO_SERVER') return 'لم يتم ضبط عنوان السيرفر';
  if (message === 'SERVER_401') return 'توكن المزامنة غير صحيح';
  if (message === 'SERVER_503') return 'السيرفر غير مضبوط بتوكن مزامنة';
  if (message.startsWith('SERVER_')) return `خطأ من السيرفر (${message.replace('SERVER_', '')})`;
  if (message.includes('Aborted') || message.includes('abort')) return 'انتهت مهلة الاتصال';
  return 'تعذّر الاتصال بالسيرفر';
}

export const useSyncStore = create<SyncState>((set, get) => ({
  status: 'idle',
  isOnline: true,
  isConfigured: false,
  pendingCount: 0,
  lastSyncIso: null,
  error: null,

  setOnline: (online: boolean) => {
    set({ isOnline: online });
    if (!online && get().status !== 'syncing') {
      set({ status: 'offline' });
    } else if (online && get().status === 'offline') {
      set({ status: 'idle' });
    }
  },

  refreshStatus: async () => {
    try {
      const [configured, pending, lastSync] = await Promise.all([
        isSyncConfigured(),
        getPendingChangesCount(),
        getLastSyncTime(),
      ]);
      set({
        isConfigured: configured,
        pendingCount: pending,
        lastSyncIso: lastSync,
        status: !configured
          ? 'disabled'
          : !get().isOnline
          ? 'offline'
          : get().status === 'syncing'
          ? 'syncing'
          : get().status,
      });
    } catch {
      // Ignore - status refresh is best-effort
    }
  },

  sync: async (silent = false) => {
    const { isOnline } = get();

    if (!(await isSyncConfigured())) {
      set({ status: 'disabled', isConfigured: false });
      return;
    }
    set({ isConfigured: true });

    if (!isOnline) {
      set({ status: 'offline' });
      return;
    }
    if (get().status === 'syncing') return;

    if (!silent) set({ status: 'syncing', error: null });
    else set({ status: 'syncing' });

    try {
      await syncNow();
      const [pending, lastSync] = await Promise.all([
        getPendingChangesCount(),
        getLastSyncTime(),
      ]);
      set({
        status: 'success',
        error: null,
        pendingCount: pending,
        lastSyncIso: lastSync,
      });
    } catch (err: any) {
      set({
        status: 'error',
        error: mapError(err?.message || ''),
      });
    }
  },
}));
