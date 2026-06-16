// ============================================================
// Invoice Service - Business logic for invoices
// ============================================================

import { getDatabase, generateId, getOrCreateDeviceId, runSerialized } from '../db/client';
import { getLocalDateKey, getLocalDayBounds } from '../utils/dates';
import type { Invoice, InvoiceItem, CartItem } from '../types';
import type { SQLiteDatabase } from 'expo-sqlite';

export interface CreateInvoiceOptions {
  invoiceName?: string;
  invoiceType?: Invoice['invoice_type'];
  merchantName?: string;
  merchantPhone?: string;
}

export interface InvoiceDaySummary {
  count: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  amountDue: number;
}

/**
 * Get the next invoice number
 */
export async function getNextInvoiceNumber(): Promise<number> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ max_num: number | null }>(
    'SELECT MAX(invoice_number) as max_num FROM invoices'
  );
  return (result?.max_num || 0) + 1;
}

async function reserveNextInvoiceNumber(db: SQLiteDatabase): Promise<number> {
  const stored = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM meta WHERE key = 'invoice_sequence'"
  );
  const maxRow = await db.getFirstAsync<{ max_num: number | null }>(
    'SELECT MAX(invoice_number) as max_num FROM invoices'
  );
  const next = Math.max(parseInt(stored?.value || '0', 10) || 0, maxRow?.max_num || 0) + 1;

  await db.runAsync(
    "INSERT INTO meta (key, value) VALUES ('invoice_sequence', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [String(next)]
  );

  return next;
}

function buildInvoiceCode(deviceId: string, invoiceNumber: number): string {
  const devicePart = deviceId.replace(/-/g, '').slice(0, 6).toUpperCase();
  return `INV-${devicePart}-${String(invoiceNumber).padStart(6, '0')}`;
}

/**
 * Create a new invoice from cart items
 * Supports partial payment - if amountPaid < total, status = 'partial'
 */
export async function createInvoice(
  cartItems: CartItem[],
  subtotal: number,
  taxAmount: number,
  total: number,
  userId: string,
  amountPaid: number,
  invoiceNameOrOptions?: string | CreateInvoiceOptions
): Promise<Invoice> {
  return runSerialized(async () => {
  const db = await getDatabase();
  const invoiceId = generateId();
  const deviceId = await getOrCreateDeviceId();
  const now = new Date().toISOString();
  const amountDue = Math.max(0, total - amountPaid);
  const status = amountDue > 0 ? 'partial' : 'completed';
  const options =
    typeof invoiceNameOrOptions === 'string'
      ? { invoiceName: invoiceNameOrOptions }
      : invoiceNameOrOptions ?? {};
  const normalizedInvoiceName = options.invoiceName?.trim() || null;
  const invoiceType = options.invoiceType ?? 'sale';
  const merchantName = options.merchantName?.trim() || null;
  const merchantPhone = options.merchantPhone?.trim() || null;

  // Start transaction
  await db.execAsync('BEGIN TRANSACTION');

  try {
    const invoiceNumber = await reserveNextInvoiceNumber(db);
    const invoiceCode = buildInvoiceCode(deviceId, invoiceNumber);

    // Insert invoice
    await db.runAsync(
      `INSERT INTO invoices (id, invoice_number, invoice_code, invoice_name, invoice_type, merchant_name, merchant_phone, user_id, subtotal, tax_amount, total, amount_paid, amount_due, payment_method, status, synced, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'cash', ?, 0, ?)`,
      [
        invoiceId,
        invoiceNumber,
        invoiceCode,
        normalizedInvoiceName,
        invoiceType,
        merchantName,
        merchantPhone,
        userId,
        subtotal,
        taxAmount,
        total,
        amountPaid,
        amountDue,
        status,
        now,
      ]
    );

    // Insert invoice items; only inventory products affect stock
    for (const item of cartItems) {
      const itemId = generateId();
      const isCustom = item.isCustom === true;

      if (!isCustom) {
        const stock = await db.getFirstAsync<{ quantity: number; name: string }>(
          'SELECT quantity, name FROM products WHERE id = ? AND is_active = 1',
          [item.product.id]
        );

        if (!stock) {
          throw new Error(`PRODUCT_NOT_FOUND:${item.product.name}`);
        }

        if (stock.quantity < item.quantity) {
          throw new Error(`INSUFFICIENT_STOCK:${stock.name}:${stock.quantity}`);
        }
      }

      await db.runAsync(
        `INSERT INTO invoice_items (id, invoice_id, product_id, product_name, quantity, unit_cost, unit_price, total, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          invoiceId,
          isCustom ? null : item.product.id,
          item.product.name,
          item.quantity,
          item.product.cost_price,
          item.product.sell_price,
          item.total,
          now,
        ]
      );

      if (!isCustom) {
        const result = await db.runAsync(
          'UPDATE products SET quantity = quantity - ? WHERE id = ? AND quantity >= ?',
          [item.quantity, item.product.id, item.quantity]
        );

        if (result.changes !== 1) {
          throw new Error(`INSUFFICIENT_STOCK:${item.product.name}`);
        }

        await db.runAsync(
          `INSERT INTO inventory_movements
            (id, product_id, delta, reason, reference_type, reference_id, note, synced, applied, created_at)
           VALUES (?, ?, ?, 'sale', 'invoice_items', ?, ?, 0, 1, ?)`,
          [
            generateId(),
            item.product.id,
            -item.quantity,
            itemId,
            invoiceId,
            now,
          ]
        );
      }
    }

    // Log sync
    await db.runAsync(
      "INSERT INTO sync_log (table_name, record_id, action, synced, created_at) VALUES ('invoices', ?, 'create', 0, ?)",
      [invoiceId, now]
    );

    await db.execAsync('COMMIT');

    return {
      id: invoiceId,
      invoice_number: invoiceNumber,
      invoice_code: invoiceCode,
      invoice_name: normalizedInvoiceName,
      invoice_type: invoiceType,
      merchant_name: merchantName,
      merchant_phone: merchantPhone,
      user_id: userId,
      subtotal,
      tax_amount: taxAmount,
      total,
      amount_paid: amountPaid,
      amount_due: amountDue,
      payment_method: 'cash',
      status: status as any,
      synced: false,
      created_at: now,
    };
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
  });
}

/**
 * Pay remaining balance on a partial invoice
 */
export async function payInvoiceBalance(
  invoiceId: string,
  additionalPayment: number
): Promise<void> {
  return runSerialized(async () => {
  const db = await getDatabase();
  const invoice = await db.getFirstAsync<Invoice>(
    'SELECT * FROM invoices WHERE id = ?',
    [invoiceId]
  );

  if (!invoice) throw new Error('Invoice not found');

  const newAmountPaid = (invoice.amount_paid || 0) + additionalPayment;
  const newAmountDue = Math.max(0, invoice.total - newAmountPaid);
  const newStatus = newAmountDue <= 0 ? 'completed' : 'partial';

  await db.runAsync(
    'UPDATE invoices SET amount_paid = ?, amount_due = ?, status = ?, synced = 0 WHERE id = ?',
    [newAmountPaid, newAmountDue, newStatus, invoiceId]
  );
  });
}

/**
 * Get invoices with outstanding balance
 */
export async function getPartialInvoices(): Promise<Invoice[]> {
  const db = await getDatabase();
  return db.getAllAsync<Invoice>(
    "SELECT * FROM invoices WHERE status = 'partial' ORDER BY created_at DESC"
  );
}

/**
 * Get invoice with its items
 */
export async function getInvoiceWithItems(
  invoiceId: string
): Promise<{ invoice: Invoice; items: InvoiceItem[] } | null> {
  const db = await getDatabase();

  const invoice = await db.getFirstAsync<Invoice>(
    'SELECT * FROM invoices WHERE id = ?',
    [invoiceId]
  );

  if (!invoice) return null;

  const items = await db.getAllAsync<InvoiceItem>(
    'SELECT * FROM invoice_items WHERE invoice_id = ?',
    [invoiceId]
  );

  return { invoice, items };
}

/**
 * Get recent invoices
 */
export async function getRecentInvoices(limit: number = 20): Promise<Invoice[]> {
  const db = await getDatabase();
  return db.getAllAsync<Invoice>(
    'SELECT * FROM invoices ORDER BY created_at DESC LIMIT ?',
    [limit]
  );
}

/**
 * Get all invoices created during a local calendar day
 */
export async function getInvoicesByDate(dateKey: string): Promise<Invoice[]> {
  const db = await getDatabase();
  const [start, end] = getLocalDayBounds(dateKey);

  return db.getAllAsync<Invoice>(
    'SELECT * FROM invoices WHERE created_at >= ? AND created_at < ? ORDER BY created_at DESC',
    [start, end]
  );
}

/**
 * Get invoice totals for a local calendar day
 */
export async function getInvoiceDaySummary(dateKey: string): Promise<InvoiceDaySummary> {
  const db = await getDatabase();
  const [start, end] = getLocalDayBounds(dateKey);
  const result = await db.getFirstAsync<{
    count: number;
    subtotal: number;
    taxAmount: number;
    total: number;
    amountPaid: number;
    amountDue: number;
  }>(
    `SELECT
      COUNT(*) as count,
      COALESCE(SUM(subtotal), 0) as subtotal,
      COALESCE(SUM(tax_amount), 0) as taxAmount,
      COALESCE(SUM(total), 0) as total,
      COALESCE(SUM(amount_paid), 0) as amountPaid,
      COALESCE(SUM(amount_due), 0) as amountDue
    FROM invoices
    WHERE status != 'refunded'
      AND created_at >= ?
      AND created_at < ?`,
    [start, end]
  );

  return result || {
    count: 0,
    subtotal: 0,
    taxAmount: 0,
    total: 0,
    amountPaid: 0,
    amountDue: 0,
  };
}

/**
 * Get today's invoices count and total
 */
export async function getTodaySummary(): Promise<{ count: number; total: number }> {
  const dateKey = getLocalDateKey();
  const summary = await getInvoiceDaySummary(dateKey);

  return { count: summary.count, total: summary.total };
}
