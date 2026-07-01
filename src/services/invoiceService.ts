// ============================================================
// Invoice Service - Business logic for invoices
// ============================================================

import { getDatabase, generateId, getOrCreateDeviceId, runSerialized } from '../db/client';
import { getLocalDateKey, getLocalDayBounds } from '../utils/dates';
import { logAuditEvent } from './auditService';
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

export interface PartialDebtSummary {
  count: number;
  totalDue: number;
  oldestDate: string | null;
}

export interface UpdateInvoiceLineInput {
  id: string;
  quantity: number;
  unitPrice: number;
}

export interface UpdateInvoiceInput {
  invoiceName?: string | null;
  merchantName?: string | null;
  merchantPhone?: string | null;
  items: UpdateInvoiceLineInput[];
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

function normalizeCartItems(cartItems: CartItem[]): CartItem[] {
  const byKey = new Map<string, CartItem>();

  for (const item of cartItems) {
    const quantity = Math.max(0, Math.floor(Number(item.quantity) || 0));
    if (quantity <= 0) continue;

    const key = item.isCustom ? `custom:${item.product.id}` : `product:${item.product.id}`;
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, {
        ...item,
        quantity,
        total: quantity * item.product.sell_price,
      });
      continue;
    }

    const nextQuantity = existing.quantity + quantity;
    byKey.set(key, {
      ...existing,
      quantity: nextQuantity,
      total: nextQuantity * existing.product.sell_price,
    });
  }

  return Array.from(byKey.values());
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
  const invoiceItems = normalizeCartItems(cartItems);

  if (invoiceItems.length === 0) {
    throw new Error('INVOICE_EMPTY');
  }

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
    for (const item of invoiceItems) {
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
      refund_amount: 0,
      refunded_at: null,
      refund_note: null,
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
  additionalPayment: number,
  userId?: string | null
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

  await logAuditEvent({
    userId,
    action: 'update',
    entityType: 'invoice',
    entityId: invoiceId,
    entityLabel: invoice.invoice_code ?? String(invoice.invoice_number),
    before: {
      amount_paid: invoice.amount_paid,
      amount_due: invoice.amount_due,
      status: invoice.status,
    },
    after: {
      amount_paid: newAmountPaid,
      amount_due: newAmountDue,
      status: newStatus,
    },
    note: 'partial_invoice_payment',
  }).catch(() => undefined);
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

export async function getPartialDebtSummary(): Promise<PartialDebtSummary> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<PartialDebtSummary>(
    `SELECT
      COUNT(*) as count,
      COALESCE(SUM(amount_due), 0) as totalDue,
      MIN(created_at) as oldestDate
     FROM invoices
     WHERE status = 'partial'`
  );

  return result || { count: 0, totalDue: 0, oldestDate: null };
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
 * Edit invoice lines and rebalance stock by the quantity difference.
 * Lines with quantity = 0 are kept as zero-value rows so remote sync can
 * overwrite older copies instead of losing a local deletion.
 */
export async function updateInvoice(
  invoiceId: string,
  input: UpdateInvoiceInput,
  userId?: string | null
): Promise<Invoice> {
  return runSerialized(async () => {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const invoice = await db.getFirstAsync<Invoice>(
    'SELECT * FROM invoices WHERE id = ?',
    [invoiceId]
  );

  if (!invoice) throw new Error('INVOICE_NOT_FOUND');
  if (invoice.status === 'refunded') throw new Error('INVOICE_REFUNDED');

  const existingItems = await db.getAllAsync<InvoiceItem>(
    'SELECT * FROM invoice_items WHERE invoice_id = ?',
    [invoiceId]
  );
  const existingById = new Map(existingItems.map((item) => [item.id, item]));
  const nextById = new Map<string, UpdateInvoiceLineInput>();

  for (const raw of input.items) {
    const existing = existingById.get(raw.id);
    if (!existing) throw new Error('INVOICE_ITEM_NOT_FOUND');

    const quantity = Math.max(0, Math.floor(Number(raw.quantity) || 0));
    const unitPrice = Math.max(0, Number(raw.unitPrice) || 0);
    nextById.set(raw.id, { id: raw.id, quantity, unitPrice });
  }

  for (const item of existingItems) {
    if (!nextById.has(item.id)) {
      nextById.set(item.id, {
        id: item.id,
        quantity: item.quantity,
        unitPrice: item.unit_price,
      });
    }
  }

  const nextLines = Array.from(nextById.values());
  if (nextLines.every((line) => line.quantity <= 0)) {
    throw new Error('INVOICE_EMPTY');
  }

  await db.execAsync('BEGIN TRANSACTION');

  try {
    let subtotal = 0;

    for (const line of nextLines) {
      const existing = existingById.get(line.id)!;
      const lineTotal = line.quantity * line.unitPrice;
      subtotal += lineTotal;

      if (existing.product_id && existing.quantity !== line.quantity) {
        const stockDelta = existing.quantity - line.quantity;

        if (stockDelta < 0) {
          const needed = Math.abs(stockDelta);
          const stock = await db.getFirstAsync<{ quantity: number; name: string }>(
            'SELECT quantity, name FROM products WHERE id = ?',
            [existing.product_id]
          );

          if (!stock) {
            throw new Error(`PRODUCT_NOT_FOUND:${existing.product_name}`);
          }

          if (stock.quantity < needed) {
            throw new Error(`INSUFFICIENT_STOCK:${stock.name}:${stock.quantity}`);
          }
        }

        const result = await db.runAsync(
          'UPDATE products SET quantity = quantity + ? WHERE id = ?',
          [stockDelta, existing.product_id]
        );

        if (result.changes !== 1) {
          throw new Error(`PRODUCT_NOT_FOUND:${existing.product_name}`);
        }

        await db.runAsync(
          `INSERT INTO inventory_movements
            (id, product_id, delta, reason, reference_type, reference_id, note, synced, applied, created_at)
           VALUES (?, ?, ?, 'sale', 'invoice_items', ?, ?, 0, 1, ?)`,
          [
            generateId(),
            existing.product_id,
            stockDelta,
            existing.id,
            `invoice_edit:${invoiceId}`,
            now,
          ]
        );
      }

      await db.runAsync(
        'UPDATE invoice_items SET quantity = ?, unit_price = ?, total = ? WHERE id = ?',
        [line.quantity, line.unitPrice, lineTotal, line.id]
      );
    }

    const taxRate = invoice.subtotal > 0 ? invoice.tax_amount / invoice.subtotal : 0;
    const taxAmount = subtotal * taxRate;
    const total = subtotal + taxAmount;
    const amountPaid = Math.min(invoice.amount_paid || 0, total);
    const amountDue = Math.max(0, total - amountPaid);
    const status = amountDue > 0 ? 'partial' : 'completed';
    const invoiceName = input.invoiceName?.trim() || null;
    const merchantName = input.merchantName?.trim() || null;
    const merchantPhone = input.merchantPhone?.trim() || null;

    await db.runAsync(
      `UPDATE invoices
       SET invoice_name = ?, merchant_name = ?, merchant_phone = ?,
           subtotal = ?, tax_amount = ?, total = ?,
           amount_paid = ?, amount_due = ?, status = ?, synced = 0
       WHERE id = ?`,
      [
        invoiceName,
        merchantName,
        merchantPhone,
        subtotal,
        taxAmount,
        total,
        amountPaid,
        amountDue,
        status,
        invoiceId,
      ]
    );

    await db.runAsync(
      "INSERT INTO sync_log (table_name, record_id, action, synced, created_at) VALUES ('invoices', ?, 'update', 0, ?)",
      [invoiceId, now]
    );

    await db.execAsync('COMMIT');

    const updatedInvoice = {
      ...invoice,
      invoice_name: invoiceName,
      merchant_name: merchantName,
      merchant_phone: merchantPhone,
      subtotal,
      tax_amount: taxAmount,
      total,
      amount_paid: amountPaid,
      amount_due: amountDue,
      status: status as Invoice['status'],
      synced: false,
    };

    await logAuditEvent({
      userId,
      action: 'update',
      entityType: 'invoice',
      entityId: invoiceId,
      entityLabel: invoice.invoice_code ?? String(invoice.invoice_number),
      before: { invoice, items: existingItems },
      after: { invoice: updatedInvoice, items: nextLines },
      note: 'invoice_edit',
    }).catch(() => undefined);

    return updatedInvoice;
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
  });
}

/**
 * Cancel an invoice, restore its sold stock, and hide it from normal reports.
 */
export async function refundInvoice(
  invoiceId: string,
  userId?: string | null,
  note?: string
): Promise<void> {
  return runSerialized(async () => {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const invoice = await db.getFirstAsync<Invoice>(
    'SELECT * FROM invoices WHERE id = ?',
    [invoiceId]
  );

  if (!invoice) throw new Error('INVOICE_NOT_FOUND');
  if (invoice.status === 'refunded') return;

  const items = await db.getAllAsync<InvoiceItem>(
    'SELECT * FROM invoice_items WHERE invoice_id = ?',
    [invoiceId]
  );

  await db.execAsync('BEGIN TRANSACTION');

  try {
    for (const item of items) {
      if (!item.product_id || item.quantity <= 0) continue;

      const result = await db.runAsync(
        'UPDATE products SET quantity = quantity + ? WHERE id = ?',
        [item.quantity, item.product_id]
      );

      if (result.changes !== 1) {
        throw new Error(`PRODUCT_NOT_FOUND:${item.product_name}`);
      }

      await db.runAsync(
        `INSERT INTO inventory_movements
          (id, product_id, delta, reason, reference_type, reference_id, note, synced, applied, created_at)
         VALUES (?, ?, ?, 'sale', 'invoice_items', ?, ?, 0, 1, ?)`,
        [
          generateId(),
          item.product_id,
          item.quantity,
          item.id,
          `invoice_refund:${invoiceId}`,
          now,
        ]
      );
    }

    await db.runAsync(
      `UPDATE invoices
       SET amount_paid = 0,
           amount_due = 0,
           status = 'refunded',
           refund_amount = ?,
           refunded_at = ?,
           refund_note = ?,
           synced = 0
       WHERE id = ?`,
      [invoice.total, now, note?.trim() || null, invoiceId]
    );

    await db.runAsync(
      "INSERT INTO sync_log (table_name, record_id, action, synced, created_at) VALUES ('invoices', ?, 'update', 0, ?)",
      [invoiceId, now]
    );

    await db.execAsync('COMMIT');

    await logAuditEvent({
      userId,
      action: 'refund',
      entityType: 'invoice',
      entityId: invoiceId,
      entityLabel: invoice.invoice_code ?? String(invoice.invoice_number),
      before: { invoice, items },
      after: {
        status: 'refunded',
        refund_amount: invoice.total,
        refunded_at: now,
        refund_note: note?.trim() || null,
      },
      note: note?.trim() || 'full_invoice_refund',
    }).catch(() => undefined);
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
  });
}

/**
 * Get recent invoices
 */
export async function getRecentInvoices(limit: number = 20): Promise<Invoice[]> {
  const db = await getDatabase();
  return db.getAllAsync<Invoice>(
    "SELECT * FROM invoices WHERE status != 'refunded' ORDER BY created_at DESC LIMIT ?",
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
    "SELECT * FROM invoices WHERE status != 'refunded' AND created_at >= ? AND created_at < ? ORDER BY created_at DESC",
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
