// ============================================================
// Settings Store - Zustand App Settings State
// ============================================================

import { create } from 'zustand';
import { getDatabase } from '../db/client';
import type { Settings } from '../types';

interface SettingsState {
  settings: Settings;
  isLoaded: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
}

const defaultSettings: Settings = {
  id: 1,
  store_name: 'محل المدخنات',
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
  server_url: '',
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
    try {
      const db = await getDatabase();
      const current = get().settings;
      const newSettings = { ...current, ...updates };

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

      if (setClauses.length > 0) {
        await db.runAsync(
          `UPDATE settings SET ${setClauses.join(', ')} WHERE id = 1`,
          values
        );
      }

      set({ settings: newSettings });
    } catch (err) {
      console.error('Error updating settings:', err);
    }
  },
}));
