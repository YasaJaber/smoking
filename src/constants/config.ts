// ============================================================
// App Configuration - Smoking POS
// ============================================================

export const APP_CONFIG = {
  name: 'Smoking POS',
  version: '1.0.0',
  defaultCurrency: 'EGP',
  defaultTaxRate: 0.14,
  defaultLowStockThreshold: 5,
  maxPinLength: 4,
  invoiceNumberPrefix: 'INV',
  syncIntervalMs: 30000, // 30 seconds
  animationEnabled: true,
} as const;

export const STORAGE_KEYS = {
  settings: 'pos_settings',
  authToken: 'auth_token',
  lastSync: 'last_sync',
  theme: 'theme_mode',
} as const;

export const DB_NAME = 'smoking_pos.db';

export const DEFAULT_SERVER_URL =
  process.env.EXPO_PUBLIC_SYNC_SERVER_URL || 'https://smoking-theta.vercel.app';

export const DEFAULT_SYNC_TOKEN =
  process.env.EXPO_PUBLIC_SYNC_TOKEN ||
  '1e3eaecdb3b561bc86760dc9fd4f4ed7c0e95fd022aeb21149098998d0768e3a';
