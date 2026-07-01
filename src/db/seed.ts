// ============================================================
// Seed Data - Production-safe startup hook
// ============================================================

import { getDatabase } from './client';

/**
 * Production builds should start with an empty catalog.
 */
/**
 * Kept for older call sites. New installations create the first admin PIN
 * from the login setup screen instead of shipping a known default PIN.
 */
export async function ensureDefaultUsers(): Promise<void> {
  return;
}

export async function seedDatabase(): Promise<void> {
  await clearPreProductionData();
  await ensureDefaultUsers();
}

async function clearPreProductionData(): Promise<void> {
  const db = await getDatabase();
  const cleanupDone = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM meta WHERE key = 'pre_production_data_cleared'"
  );
  if (cleanupDone?.value === '1') return;

  const existingData = await db.getFirstAsync<{ count: number }>(
    `SELECT
      (SELECT COUNT(*) FROM products) +
      (SELECT COUNT(*) FROM categories) +
      (SELECT COUNT(*) FROM invoices) +
      (SELECT COUNT(*) FROM invoice_items) +
      (SELECT COUNT(*) FROM purchases) +
      (SELECT COUNT(*) FROM purchase_items) +
      (SELECT COUNT(*) FROM inventory_movements) +
      (SELECT COUNT(*) FROM users) AS count`
  );

  if ((existingData?.count || 0) > 0) {
    await db.runAsync(
      "INSERT OR REPLACE INTO meta (key, value) VALUES ('pre_production_data_cleared', '1')"
    );
    return;
  }

  await db.execAsync('BEGIN TRANSACTION');
  try {
    await db.runAsync('DELETE FROM invoice_items');
    await db.runAsync('DELETE FROM invoices');
    await db.runAsync('DELETE FROM purchase_items');
    await db.runAsync('DELETE FROM purchases');
    await db.runAsync('DELETE FROM inventory_movements');
    await db.runAsync('DELETE FROM products');
    await db.runAsync('DELETE FROM categories');
    await db.runAsync('DELETE FROM sync_log');
    await db.runAsync('DELETE FROM audit_events');
    await db.runAsync('DELETE FROM daily_closes');
    await db.runAsync('DELETE FROM users');
    await db.runAsync(
      "INSERT OR REPLACE INTO meta (key, value) VALUES ('last_sync', '0')"
    );
    await db.runAsync(
      "INSERT OR REPLACE INTO meta (key, value) VALUES ('pre_production_data_cleared', '1')"
    );
    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}
