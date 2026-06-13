// ============================================================
// Sync Service - Bidirectional sync with the central server
//
// Strategy: a single round-trip "push + pull" against POST /api/sync.
//  - PUSH: every locally-changed row (synced = 0) is sent to the server.
//  - PULL: the server returns every row changed since our last sync cursor.
//  - Conflicts are resolved Last-Write-Wins by `updated_at` (products /
//    categories). Invoices are effectively append-only.
//
// The server is the source of truth for the sync cursor (serverTime), which
// avoids clock-skew problems between multiple devices.
// ============================================================

import { getDatabase, getMeta, setMeta, generateId } from '../db/client';

const SYNC_PATH = '/api/sync';
const REQUEST_TIMEOUT_MS = 15000;

export interface SyncResult {
  pushed: number;
  pulled: number;
  serverTime: number;
}

interface SyncPayload {
  serverTime: number;
  changes: {
    categories?: any[];
    products?: any[];
    invoices?: any[];
    invoice_items?: any[];
  };
}

const TABLE_COLUMNS: Record<string, string[]> = {
  categories: ['id', 'name', 'icon', 'color', 'sort_order', 'is_active', 'synced', 'created_at', 'updated_at'],
  products: ['id', 'category_id', 'name', 'barcode', 'cost_price', 'sell_price', 'quantity', 'min_quantity', 'image_uri', 'is_active', 'synced', 'created_at', 'updated_at'],
  invoices: ['id', 'invoice_number', 'invoice_name', 'user_id', 'subtotal', 'tax_amount', 'total', 'amount_paid', 'amount_due', 'payment_method', 'status', 'synced', 'created_at'],
  invoice_items: ['id', 'invoice_id', 'product_id', 'product_name', 'quantity', 'unit_cost', 'unit_price', 'total', 'created_at'],
};

/**
 * Get the configured server base URL (trailing slash stripped) or null.
 */
async function getServerUrl(): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ server_url: string }>(
    'SELECT server_url FROM settings WHERE id = 1'
  );
  const url = row?.server_url?.trim();
  if (!url) return null;
  return url.replace(/\/+$/, '');
}

/**
 * Stable per-install device id (used by the server to skip echoing back our
 * own pushes). Generated once and persisted in the meta table.
 */
async function getDeviceId(): Promise<string> {
  let id = await getMeta('device_id');
  if (!id) {
    id = generateId();
    await setMeta('device_id', id);
  }
  return id;
}

/**
 * Whether a server URL has been configured.
 */
export async function isSyncConfigured(): Promise<boolean> {
  return (await getServerUrl()) !== null;
}

/**
 * Run a fetch with a hard timeout.
 */
async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Collect every locally-changed row that still needs to be pushed.
 */
async function collectLocalChanges() {
  const db = await getDatabase();

  const categories = await db.getAllAsync<any>(
    `SELECT ${TABLE_COLUMNS.categories.join(', ')} FROM categories WHERE synced = 0`
  );
  const products = await db.getAllAsync<any>(
    `SELECT ${TABLE_COLUMNS.products.join(', ')} FROM products WHERE synced = 0`
  );
  const invoices = await db.getAllAsync<any>(
    `SELECT ${TABLE_COLUMNS.invoices.join(', ')} FROM invoices WHERE synced = 0`
  );

  let invoice_items: any[] = [];
  if (invoices.length > 0) {
    const placeholders = invoices.map(() => '?').join(', ');
    invoice_items = await db.getAllAsync<any>(
      `SELECT * FROM invoice_items WHERE invoice_id IN (${placeholders})`,
      invoices.map((i) => i.id)
    );
  }

  return { categories, products, invoices, invoice_items };
}

/**
 * Upsert pulled rows into a local table (Last-Write-Wins on `updated_at`
 * for tables that have it). Pulled rows are always marked synced = 1 so they
 * are not pushed straight back to the server.
 */
async function applyPulledRows(table: string, rows: any[]): Promise<void> {
  if (!rows || rows.length === 0) return;
  const db = await getDatabase();
  const columns = TABLE_COLUMNS[table];
  const hasUpdatedAt = columns.includes('updated_at');
  const hasSynced = columns.includes('synced');

  const placeholders = columns.map(() => '?').join(', ');
  const updateColumns = columns.filter((c) => c !== 'id');
  const setClause = updateColumns.map((c) => `${c} = excluded.${c}`).join(', ');

  let sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${setClause}`;
  if (hasUpdatedAt) {
    sql += ` WHERE excluded.updated_at >= ${table}.updated_at`;
  }

  for (const row of rows) {
    if (hasSynced) row.synced = 1;
    const values = columns.map((c) => (row[c] === undefined ? null : row[c]));
    await db.runAsync(sql, values);
  }
}

/**
 * Mark a set of rows as synced after a successful push.
 */
async function markSynced(table: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDatabase();
  const placeholders = ids.map(() => '?').join(', ');
  await db.runAsync(
    `UPDATE ${table} SET synced = 1 WHERE id IN (${placeholders})`,
    ids
  );
}

/**
 * Perform a full bidirectional sync. Throws on network/server errors so the
 * caller can surface a friendly message.
 */
export async function syncNow(): Promise<SyncResult> {
  const base = await getServerUrl();
  if (!base) {
    throw new Error('NO_SERVER');
  }

  const deviceId = await getDeviceId();
  const lastSyncAt = parseInt((await getMeta('last_sync')) || '0', 10);

  const local = await collectLocalChanges();
  const pushedCount =
    local.categories.length + local.products.length + local.invoices.length;

  const response = await fetchWithTimeout(`${base}${SYNC_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId,
      lastSyncAt,
      changes: local,
    }),
  });

  if (!response.ok) {
    throw new Error(`SERVER_${response.status}`);
  }

  const payload = (await response.json()) as SyncPayload;
  const remote = payload.changes || {};

  // Apply server changes first (parents before children for FK safety).
  await applyPulledRows('categories', remote.categories || []);
  await applyPulledRows('products', remote.products || []);
  await applyPulledRows('invoices', remote.invoices || []);
  await applyPulledRows('invoice_items', remote.invoice_items || []);

  // Mark our pushed rows as synced.
  await markSynced('categories', local.categories.map((r) => r.id));
  await markSynced('products', local.products.map((r) => r.id));
  await markSynced('invoices', local.invoices.map((r) => r.id));

  // Advance the sync cursor.
  await setMeta('last_sync', String(payload.serverTime));
  await setMeta('last_sync_at_iso', new Date().toISOString());

  const pulledCount =
    (remote.categories?.length || 0) +
    (remote.products?.length || 0) +
    (remote.invoices?.length || 0);

  return { pushed: pushedCount, pulled: pulledCount, serverTime: payload.serverTime };
}

/**
 * Count rows still waiting to be pushed (used by the sync indicator).
 */
export async function getPendingChangesCount(): Promise<number> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ count: number }>(
    `SELECT
      (SELECT COUNT(*) FROM categories WHERE synced = 0) +
      (SELECT COUNT(*) FROM products WHERE synced = 0) +
      (SELECT COUNT(*) FROM invoices WHERE synced = 0) AS count`
  );
  return result?.count || 0;
}

/**
 * The ISO timestamp of the last successful sync, or null.
 */
export async function getLastSyncTime(): Promise<string | null> {
  return getMeta('last_sync_at_iso');
}
