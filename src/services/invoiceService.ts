// ============================================================
// Invoice Service - Business logic for invoices
// ============================================================

import { getDatabase, generateId } from '../db/client';
import type { Invoice, InvoiceItem, CartItem } from '../types';

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
  amountPaid: number
): Promise<Invoice> {
  const db = await getDatabase();
  const invoiceId = generateId();
  const invoiceNumber = await getNextInvoiceNumber();
  const now = new Date().toISOString();
  const amountDue = Math.max(0, total - amountPaid);
  const status = amountDue > 0 ? 'partial' : 'completed';

  // Start transaction
  await db.execAsync('BEGIN TRANSACTION');

  try {
    // Insert invoice
    await db.runAsync(
      `INSERT INTO invoices (id, invoice_number, user_id, subtotal, tax_amount, total, amount_paid, amount_due, payment_method, status, synced, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'cash', ?, 0, ?)`,
      [invoiceId, invoiceNumber, userId, subtotal, taxAmount, total, amountPaid, amountDue, status, now]
    );

    // Insert invoice items and update stock
    for (const item of cartItems) {
      const itemId = generateId();
      await db.runAsync(
        `INSERT INTO invoice_items (id, invoice_id, product_id, product_name, quantity, unit_cost, unit_price, total, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          invoiceId,
          item.product.id,
          item.product.name,
          item.quantity,
          item.product.cost_price,
          item.product.sell_price,
          item.total,
          now,
        ]
      );

      // Decrease product stock (mark unsynced so the new quantity is pushed)
      await db.runAsync(
        'UPDATE products SET quantity = MAX(0, quantity - ?), synced = 0, updated_at = ? WHERE id = ?',
        [item.quantity, now, item.product.id]
      );
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
 * Get today's invoices count and total
 */
export async function getTodaySummary(): Promise<{ count: number; total: number }> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ count: number; total: number }>(
    "SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total FROM invoices WHERE date(created_at) = date('now') AND status != 'refunded'"
  );
  return result || { count: 0, total: 0 };
}
