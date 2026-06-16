// ============================================================
// Database Client - SQLite Connection & Initialization
// ============================================================

import * as SQLite from 'expo-sqlite';
import { DB_NAME, DEFAULT_SERVER_URL } from '../constants/config';

let db: SQLite.SQLiteDatabase | null = null;
let dbOpenPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let initializationPromise: Promise<void> | null = null;
let serializedQueue: Promise<void> = Promise.resolve();

/**
 * Get or create the database connection
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  if (!dbOpenPromise) {
    dbOpenPromise = (async () => {
      const database = await SQLite.openDatabaseAsync(DB_NAME, {
        useNewConnection: true,
      });
      // Enable WAL mode for better concurrent performance
      await database.execAsync('PRAGMA journal_mode = WAL;');
      await database.execAsync('PRAGMA foreign_keys = ON;');
      db = database;
      return database;
    })().finally(() => {
      dbOpenPromise = null;
    });
  }

  return dbOpenPromise;
}

/**
 * Initialize all database tables
 */
export async function initializeDatabase(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      const database = await getDatabase();

      await database.execAsync(`
        -- Settings table
        CREATE TABLE IF NOT EXISTS settings (
          id INTEGER PRIMARY KEY DEFAULT 1,
          store_name TEXT DEFAULT 'smoking',
          phone TEXT DEFAULT '',
          logo_uri TEXT DEFAULT '',
          tax_enabled INTEGER DEFAULT 0,
          tax_rate REAL DEFAULT 0.14,
          dark_mode INTEGER DEFAULT 1,
          printer_address TEXT DEFAULT '',
          printer_type TEXT DEFAULT 'bluetooth',
          welcome_message TEXT DEFAULT 'مرحباً بكم',
          footer_message TEXT DEFAULT 'شكراً لزيارتكم',
          currency TEXT DEFAULT 'EGP',
          low_stock_threshold INTEGER DEFAULT 5,
          server_url TEXT DEFAULT 'https://smoking-theta.vercel.app',
          sync_token TEXT DEFAULT '',
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );

        -- Key/value metadata table (e.g. last_sync cursor)
        CREATE TABLE IF NOT EXISTS meta (
          key TEXT PRIMARY KEY,
          value TEXT
        );

        -- Users table
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          pin TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('admin', 'cashier')),
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now'))
        );

        -- Categories table
        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          icon TEXT DEFAULT '📦',
          color TEXT DEFAULT '#6366f1',
          sort_order INTEGER DEFAULT 0,
          is_active INTEGER DEFAULT 1,
          synced INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );

        -- Products table
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          category_id TEXT NOT NULL REFERENCES categories(id),
          name TEXT NOT NULL,
          barcode TEXT,
          cost_price REAL NOT NULL DEFAULT 0,
          sell_price REAL NOT NULL DEFAULT 0,
          quantity INTEGER NOT NULL DEFAULT 0,
          min_quantity INTEGER DEFAULT 5,
          image_uri TEXT,
          is_active INTEGER DEFAULT 1,
          synced INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );

        -- Invoices table
        CREATE TABLE IF NOT EXISTS invoices (
          id TEXT PRIMARY KEY,
          invoice_number INTEGER NOT NULL,
          invoice_code TEXT,
          invoice_name TEXT,
          invoice_type TEXT DEFAULT 'sale' CHECK(invoice_type IN ('sale', 'merchant')),
          merchant_name TEXT,
          merchant_phone TEXT,
          user_id TEXT REFERENCES users(id),
          subtotal REAL NOT NULL DEFAULT 0,
          tax_amount REAL NOT NULL DEFAULT 0,
          total REAL NOT NULL DEFAULT 0,
          amount_paid REAL NOT NULL DEFAULT 0,
          amount_due REAL NOT NULL DEFAULT 0,
          payment_method TEXT DEFAULT 'cash',
          status TEXT DEFAULT 'completed' CHECK(status IN ('completed', 'partial', 'refunded')),
          synced INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        );

        -- Invoice items table
        CREATE TABLE IF NOT EXISTS invoice_items (
          id TEXT PRIMARY KEY,
          invoice_id TEXT NOT NULL REFERENCES invoices(id),
          product_id TEXT,
          product_name TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          unit_cost REAL NOT NULL,
          unit_price REAL NOT NULL,
          total REAL NOT NULL,
          created_at TEXT DEFAULT (datetime('now'))
        );

        -- Sync log table
        CREATE TABLE IF NOT EXISTS sync_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          table_name TEXT NOT NULL,
          record_id TEXT NOT NULL,
          action TEXT NOT NULL CHECK(action IN ('create', 'update', 'delete')),
          synced INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        );

        -- Inventory movement ledger.
        -- Product quantity is a materialized balance. Cross-device sync moves
        -- quantity by applying these immutable deltas once per movement id.
        CREATE TABLE IF NOT EXISTS inventory_movements (
          id TEXT PRIMARY KEY,
          product_id TEXT NOT NULL REFERENCES products(id),
          delta INTEGER NOT NULL,
          reason TEXT NOT NULL CHECK(reason IN ('sale', 'purchase', 'purchase_reversal', 'adjustment')),
          reference_type TEXT NOT NULL,
          reference_id TEXT NOT NULL,
          note TEXT,
          synced INTEGER DEFAULT 0,
          applied INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now'))
        );

        -- Purchases table (budget-based purchasing)
        CREATE TABLE IF NOT EXISTS purchases (
          id TEXT PRIMARY KEY,
          budget REAL NOT NULL DEFAULT 0,
          spent REAL NOT NULL DEFAULT 0,
          remaining REAL NOT NULL DEFAULT 0,
          note TEXT,
          status TEXT DEFAULT 'open' CHECK(status IN ('open', 'closed')),
          is_deleted INTEGER DEFAULT 0,
          synced INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );

        -- Purchase items table
        CREATE TABLE IF NOT EXISTS purchase_items (
          id TEXT PRIMARY KEY,
          purchase_id TEXT NOT NULL REFERENCES purchases(id),
          product_id TEXT,
          product_name TEXT NOT NULL,
          category_id TEXT REFERENCES categories(id),
          cost_price REAL NOT NULL DEFAULT 0,
          sell_price REAL NOT NULL DEFAULT 0,
          quantity INTEGER NOT NULL DEFAULT 0,
          total_cost REAL NOT NULL DEFAULT 0,
          is_deleted INTEGER DEFAULT 0,
          synced INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        );

        -- Create indexes for performance
        CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
        CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
        CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(created_at);
        CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
        CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
        CREATE INDEX IF NOT EXISTS idx_sync_log_synced ON sync_log(synced);
        CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
        CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(created_at);
        CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
        CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
        CREATE INDEX IF NOT EXISTS idx_inventory_movements_synced ON inventory_movements(synced);
        CREATE INDEX IF NOT EXISTS idx_inventory_movements_ref ON inventory_movements(reference_type, reference_id);

        -- Insert default settings if not exist
        INSERT OR IGNORE INTO settings (id) VALUES (1);
      `);

      await runMigrations(database);
    })().catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }

  return initializationPromise;
}

/**
 * Apply incremental migrations for databases created by older app versions.
 * Each statement is wrapped in try/catch because SQLite cannot add a column
 * conditionally (it throws if the column already exists).
 */
async function runMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
  const safeAlters = [
    "ALTER TABLE settings ADD COLUMN server_url TEXT DEFAULT ''",
    "ALTER TABLE settings ADD COLUMN sync_token TEXT DEFAULT ''",
    "ALTER TABLE invoices ADD COLUMN invoice_code TEXT",
    "ALTER TABLE invoices ADD COLUMN invoice_name TEXT",
    "ALTER TABLE invoices ADD COLUMN invoice_type TEXT DEFAULT 'sale'",
    "ALTER TABLE invoices ADD COLUMN merchant_name TEXT",
    "ALTER TABLE invoices ADD COLUMN merchant_phone TEXT",
    "ALTER TABLE purchases ADD COLUMN synced INTEGER DEFAULT 0",
    "ALTER TABLE purchases ADD COLUMN is_deleted INTEGER DEFAULT 0",
    "ALTER TABLE purchase_items ADD COLUMN synced INTEGER DEFAULT 0",
    "ALTER TABLE purchase_items ADD COLUMN is_deleted INTEGER DEFAULT 0",
  ];

  for (const sql of safeAlters) {
    try {
      await database.execAsync(sql);
    } catch {
      // Column already exists - ignore
    }
  }

  await database.runAsync(
    "UPDATE settings SET store_name = 'smoking' WHERE store_name = ?",
    ['محل المدخنات']
  );

  await database.runAsync(
    "UPDATE settings SET server_url = ? WHERE id = 1 AND (server_url IS NULL OR trim(server_url) = '')",
    [DEFAULT_SERVER_URL]
  );

  await migrateInvoiceItemsNullableProductId(database);
  await migrateInvoiceCodes(database);
}

/**
 * Allow invoice line items without a linked inventory product (quick/ad-hoc items).
 */
async function migrateInvoiceItemsNullableProductId(
  database: SQLite.SQLiteDatabase
): Promise<void> {
  const row = await database.getFirstAsync<{ value: string }>(
    "SELECT value FROM meta WHERE key = 'invoice_items_nullable_product_id'"
  );
  if (row?.value === '1') return;

  const tableInfo = await database.getAllAsync<{ name: string; notnull: number }>(
    'PRAGMA table_info(invoice_items)'
  );
  const productIdColumn = tableInfo.find((col) => col.name === 'product_id');
  if (productIdColumn && productIdColumn.notnull === 0) {
    await database.runAsync(
      "INSERT OR REPLACE INTO meta (key, value) VALUES ('invoice_items_nullable_product_id', '1')"
    );
    return;
  }

  await database.execAsync('PRAGMA foreign_keys = OFF');

  try {
    await database.execAsync(`
      CREATE TABLE invoice_items_new (
        id TEXT PRIMARY KEY,
        invoice_id TEXT NOT NULL REFERENCES invoices(id),
        product_id TEXT,
        product_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_cost REAL NOT NULL,
        unit_price REAL NOT NULL,
        total REAL NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );

      INSERT INTO invoice_items_new (
        id, invoice_id, product_id, product_name, quantity, unit_cost, unit_price, total, created_at
      )
      SELECT
        id, invoice_id, product_id, product_name, quantity, unit_cost, unit_price, total, created_at
      FROM invoice_items;

      DROP TABLE invoice_items;
      ALTER TABLE invoice_items_new RENAME TO invoice_items;
      CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
    `);

    await database.runAsync(
      "INSERT OR REPLACE INTO meta (key, value) VALUES ('invoice_items_nullable_product_id', '1')"
    );
  } finally {
    await database.execAsync('PRAGMA foreign_keys = ON');
  }
}

/**
 * Backfill a stable display code for older invoices that only had a local
 * sequence number. New invoices include a per-install device suffix.
 */
async function migrateInvoiceCodes(database: SQLite.SQLiteDatabase): Promise<void> {
  const row = await database.getFirstAsync<{ value: string }>(
    "SELECT value FROM meta WHERE key = 'invoice_codes_backfilled'"
  );
  if (row?.value === '1') return;

  const invoices = await database.getAllAsync<{ id: string; invoice_number: number }>(
    "SELECT id, invoice_number FROM invoices WHERE invoice_code IS NULL OR trim(invoice_code) = ''"
  );

  for (const invoice of invoices) {
    await database.runAsync(
      'UPDATE invoices SET invoice_code = ? WHERE id = ?',
      [`INV-LOCAL-${String(invoice.invoice_number).padStart(6, '0')}`, invoice.id]
    );
  }

  await database.runAsync(
    "INSERT OR REPLACE INTO meta (key, value) VALUES ('invoice_codes_backfilled', '1')"
  );
}

/**
 * Read a value from the meta key/value table
 */
export async function getMeta(key: string): Promise<string | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM meta WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

/**
 * Write a value to the meta key/value table
 */
export async function setMeta(key: string, value: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  );
}

/**
 * Close the database connection
 */
export async function closeDatabase(): Promise<void> {
  if (dbOpenPromise) {
    await dbOpenPromise;
  }
  if (db) {
    await db.closeAsync();
    db = null;
  }
  initializationPromise = null;
}

/**
 * Serialize critical write/sync workflows that share the same SQLite
 * connection. This prevents background sync from observing a half-finished
 * sale/purchase transaction.
 */
export async function runSerialized<T>(operation: () => Promise<T>): Promise<T> {
  const run = serializedQueue.then(operation, operation);
  serializedQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/**
 * Generate a UUID v4
 */
export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Stable per-install device id used by sync and human-safe invoice codes.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  let id = await getMeta('device_id');
  if (!id) {
    id = generateId();
    await setMeta('device_id', id);
  }
  return id;
}
