// ============================================================
// Invoice Service - Business logic for invoices
// ============================================================

import { getDatabase, generateId } from '../db/client';
import type { Invoice, InvoiceItem, CartItem } from '../types';

export interface InvoiceDaySummary {
  count: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  amountDue: number;
}

function getLocalDayBounds(dateKey: string): [string, string] {
  const [year, month, day] = dateKey.split('-').map(Number);
  const start = new Date(year, month - 1, day);
  const end = new Date(year, month - 1, day + 1);

  return [start.toISOString(), end.toISOString()];
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
  invoiceName?: string
): Promise<Invoice> {
  const db = await getDatabase();
  const invoiceId = generateId();
  const invoiceNumber = await getNextInvoiceNumber();
  const now = new Date().toISOString();
  const amountDue = Math.max(0, total - amountPaid);
  const status = amountDue > 0 ? 'partial' : 'completed';
  const normalizedInvoiceName = invoiceName?.trim() || null;

  // Start transaction
  await db.execAsync('BEGIN TRANSACTION');

  try {
    // Insert invoice
    await db.runAsync(
      `INSERT INTO invoices (id, invoice_number, invoice_name, user_id, subtotal, tax_amount, total, amount_paid, amount_due, payment_method, status, synced, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'cash', ?, 0, ?)`,
      [
        invoiceId,
        invoiceNumber,
        normalizedInvoiceName,
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
        await db.runAsync(
          'UPDATE products SET quantity = MAX(0, quantity - ?), synced = 0, updated_at = ? WHERE id = ?',
          [item.quantity, now, item.product.id]
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
      invoice_name: normalizedInvoiceName,
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
}

/**
 * Pay remaining balance on a partial invoice
 */
export async function payInvoiceBalance(
  invoiceId: string,
  additionalPayment: number
): Promise<void> {
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
  const today = new Date();
  const dateKey = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  const summary = await getInvoiceDaySummary(dateKey);

  return { count: summary.count, total: summary.total };
}
