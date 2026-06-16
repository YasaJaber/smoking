// ============================================================
// Daily Close Service - sales, cash, refunds and close snapshot
// ============================================================

import { generateId, getDatabase, runSerialized } from '../db/client';
import { getLocalDateKey, getLocalDayBounds } from '../utils/dates';
import { logAuditEvent } from './auditService';
import type { DailyCloseReport, DailyCloseSnapshot } from '../types';

export async function getDailyCloseReport(dateKey = getLocalDateKey()): Promise<DailyCloseReport> {
  const db = await getDatabase();
  const [start, end] = getLocalDayBounds(dateKey);

  const sales = await db.getFirstAsync<{
    gross_sales: number;
    cash_collected: number;
    outstanding_due: number;
    profit: number;
    invoice_count: number;
    partial_count: number;
    items_sold: number;
  }>(
    `SELECT
      COALESCE(SUM(i.total), 0) as gross_sales,
      COALESCE(SUM(i.amount_paid), 0) as cash_collected,
      COALESCE(SUM(i.amount_due), 0) as outstanding_due,
      COALESCE(SUM(ii_profit.total_profit), 0) as profit,
      COUNT(i.id) as invoice_count,
      COALESCE(SUM(CASE WHEN i.status = 'partial' THEN 1 ELSE 0 END), 0) as partial_count,
      COALESCE(SUM(ii_profit.items_sold), 0) as items_sold
    FROM invoices i
    LEFT JOIN (
      SELECT
        invoice_id,
        SUM((unit_price - unit_cost) * quantity) as total_profit,
        SUM(quantity) as items_sold
      FROM invoice_items
      GROUP BY invoice_id
    ) ii_profit ON ii_profit.invoice_id = i.id
    WHERE i.status != 'refunded'
      AND i.created_at >= ?
      AND i.created_at < ?`,
    [start, end]
  );

  const refunds = await db.getFirstAsync<{ refunds_total: number }>(
    `SELECT COALESCE(SUM(refund_amount), 0) as refunds_total
     FROM invoices
     WHERE refunded_at IS NOT NULL
       AND refunded_at >= ?
       AND refunded_at < ?`,
    [start, end]
  );

  const lowStock = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM products WHERE is_active = 1 AND quantity <= min_quantity'
  );

  const audits = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM audit_events WHERE created_at >= ? AND created_at < ?',
    [start, end]
  );

  const grossSales = sales?.gross_sales || 0;
  const refundsTotal = refunds?.refunds_total || 0;

  return {
    date_key: dateKey,
    gross_sales: grossSales,
    net_sales: grossSales - refundsTotal,
    cash_collected: sales?.cash_collected || 0,
    outstanding_due: sales?.outstanding_due || 0,
    refunds_total: refundsTotal,
    profit: sales?.profit || 0,
    invoice_count: sales?.invoice_count || 0,
    partial_count: sales?.partial_count || 0,
    items_sold: sales?.items_sold || 0,
    low_stock_count: lowStock?.count || 0,
    audit_count: audits?.count || 0,
  };
}

export async function getDailyCloseSnapshot(
  dateKey = getLocalDateKey()
): Promise<DailyCloseSnapshot | null> {
  const db = await getDatabase();
  return db.getFirstAsync<DailyCloseSnapshot>(
    'SELECT *, 0 as low_stock_count, 0 as audit_count FROM daily_closes WHERE date_key = ?',
    [dateKey]
  );
}

export async function closeDay(
  dateKey: string,
  userId?: string | null,
  note?: string
): Promise<DailyCloseSnapshot> {
  return runSerialized(async () => {
    const db = await getDatabase();
    const report = await getDailyCloseReport(dateKey);
    const existing = await getDailyCloseSnapshot(dateKey);
    const now = new Date().toISOString();
    const id = existing?.id ?? generateId();

    await db.runAsync(
      `INSERT INTO daily_closes
        (id, date_key, user_id, gross_sales, net_sales, cash_collected, outstanding_due,
         refunds_total, profit, invoice_count, partial_count, items_sold, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(date_key) DO UPDATE SET
         user_id = excluded.user_id,
         gross_sales = excluded.gross_sales,
         net_sales = excluded.net_sales,
         cash_collected = excluded.cash_collected,
         outstanding_due = excluded.outstanding_due,
         refunds_total = excluded.refunds_total,
         profit = excluded.profit,
         invoice_count = excluded.invoice_count,
         partial_count = excluded.partial_count,
         items_sold = excluded.items_sold,
         note = excluded.note,
         updated_at = excluded.updated_at`,
      [
        id,
        dateKey,
        userId ?? null,
        report.gross_sales,
        report.net_sales,
        report.cash_collected,
        report.outstanding_due,
        report.refunds_total,
        report.profit,
        report.invoice_count,
        report.partial_count,
        report.items_sold,
        note?.trim() || null,
        existing?.created_at ?? now,
        now,
      ]
    );

    await logAuditEvent({
      userId,
      action: 'close',
      entityType: 'daily_close',
      entityId: dateKey,
      entityLabel: dateKey,
      after: report,
      note,
    });

    return {
      id,
      user_id: userId ?? null,
      note: note?.trim() || null,
      created_at: existing?.created_at ?? now,
      updated_at: now,
      ...report,
    };
  });
}
