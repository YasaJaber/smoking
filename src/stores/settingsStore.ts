// ============================================================
// Settings Store - Zustand App Settings State
// ============================================================

import { create } from 'zustand';
import { getDatabase, runSerialized } from '../db/client';
import { DEFAULT_SERVER_URL } from '../constants/config';
import type { Settings } from '../types';

interface SettingsState {
  settings: Settings;
  isLoaded: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
}

const defaultSettings: Settings = {
  id: 1,
  store_name: 'smoking',
  phone: '',
  logo_uri: '',
  tax_enabled: false,
  tax_rate: 0.14,
  dark_mode: true,
  printer_address: '',
  printer_type: 'bluetooth',
  welcome_message: 'مرحباً بكم',
  footer_message: 'شكراً لزيارتكم',
  currency: 'EGP',
  low_stock_threshold: 5,
  server_url: DEFAULT_SERVER_URL,
  sync_token: '',
  created_at: '',
  updated_at: '',
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  isLoaded: false,

  loadSettings: async () => {
    try {
      const db = await getDatabase();
      const row = await db.getFirstAsync<any>(
        'SELECT * FROM settings WHERE id = 1'
      );
      if (row) {
        set({
          settings: {
            ...row,
            tax_enabled: Boolean(row.tax_enabled),
            dark_mode: Boolean(row.dark_mode),
          },
          isLoaded: true,
        });
      } else {
        set({ isLoaded: true });
      }
    } catch (err) {
      console.error('Error loading settings:', err);
      set({ isLoaded: true });
    }
  },

  updateSettings: async (updates: Partial<Settings>) => {
    return runSerialized(async () => {
    const current = get().settings;
    const newSettings = { ...current, ...updates };

    try {
      const db = await getDatabase();

      const setClauses: string[] = [];
      const values: any[] = [];

      for (const [key, value] of Object.entries(updates)) {
        if (key === 'id' || key === 'created_at') continue;
        setClauses.push(`${key} = ?`);
        if (typeof value === 'boolean') {
          values.push(value ? 1 : 0);
        } else {
          values.push(value);
        }
      }

      setClauses.push("updated_at = datetime('now')");

      if (values.length > 0) {
        const result = await db.runAsync(
          `UPDATE settings SET ${setClauses.join(', ')} WHERE id = 1`,
          values
        );
        if (result.changes !== 1) {
          throw new Error('SETTINGS_NOT_SAVED');
        }
      }

      set({ settings: newSettings });
    } catch (err) {
      console.error('Error updating settings:', err);
      throw err;
    }
    });
  },
}));
