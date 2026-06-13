// ============================================================
// Analytics Service - Business logic for reports & stats
// ============================================================

import { getDatabase } from '../db/client';
import { getLocalDateKey, getLocalDayBounds } from '../utils/dates';
import type { AnalyticsSummary, DailySales, TopProduct } from '../types';

function getLocalRangeBounds(startDate: string, endDate: string): [string, string] {
  const [start] = getLocalDayBounds(startDate);
  const [, end] = getLocalDayBounds(endDate);
  return [start, end];
}

/**
 * Get analytics summary for a date range
 */
export async function getAnalyticsSummary(
  startDate: string,
  endDate: string
): Promise<AnalyticsSummary> {
  const db = await getDatabase();
  const [start, end] = getLocalRangeBounds(startDate, endDate);
  const result = await db.getFirstAsync<any>(
    `SELECT
      COALESCE((SELECT SUM(total)
        FROM invoices
        WHERE status != 'refunded' AND created_at >= ? AND created_at < ?), 0) as total_revenue,
      COALESCE((SELECT SUM(ii.unit_cost * ii.quantity)
        FROM invoice_items ii
        JOIN invoices i ON i.id = ii.invoice_id
        WHERE i.status != 'refunded' AND i.created_at >= ? AND i.created_at < ?), 0) as total_cost,
      COALESCE((SELECT COUNT(*)
        FROM invoices
        WHERE status != 'refunded' AND created_at >= ? AND created_at < ?), 0) as total_invoices,
      COALESCE((SELECT SUM(ii.quantity)
        FROM invoice_items ii
        JOIN invoices i ON i.id = ii.invoice_id
        WHERE i.status != 'refunded' AND i.created_at >= ? AND i.created_at < ?), 0) as total_items_sold`,
    [start, end, start, end, start, end, start, end]
  );

  const totalRevenue = result?.total_revenue || 0;
  const totalCost = result?.total_cost || 0;
  const totalInvoices = result?.total_invoices || 0;

  return {
    total_revenue: totalRevenue,
    total_cost: totalCost,
    total_profit: totalRevenue - totalCost,
    total_invoices: totalInvoices,
    total_items_sold: result?.total_items_sold || 0,
    avg_invoice_value: totalInvoices > 0 ? totalRevenue / totalInvoices : 0,
  };
}

/**
 * Get daily sales data for charts
 */
export async function getDailySales(
  startDate: string,
  endDate: string
): Promise<DailySales[]> {
  const db = await getDatabase();
  const [start, end] = getLocalRangeBounds(startDate, endDate);
  const rows = await db.getAllAsync<any>(
    `SELECT
      date(i.created_at, 'localtime') as date,
      SUM(i.total) as revenue,
      SUM(i.total) - COALESCE(SUM(ii_cost.total_cost), 0) as profit,
      COUNT(DISTINCT i.id) as count
    FROM invoices i
    LEFT JOIN (
      SELECT invoice_id, SUM(unit_cost * quantity) as total_cost
      FROM invoice_items GROUP BY invoice_id
    ) ii_cost ON i.id = ii_cost.invoice_id
    WHERE i.status != 'refunded'
      AND i.created_at >= ?
      AND i.created_at < ?
    GROUP BY date(i.created_at, 'localtime')
    ORDER BY date(i.created_at, 'localtime') ASC`,
    [start, end]
  );

  return rows.map((r: any) => ({
    date: r.date,
    revenue: r.revenue || 0,
    profit: r.profit || 0,
    count: r.count || 0,
  }));
}

/**
 * Get top selling products
 */
export async function getTopProducts(
  startDate: string,
  endDate: string,
  limit: number = 5
): Promise<TopProduct[]> {
  const db = await getDatabase();
  const [start, end] = getLocalRangeBounds(startDate, endDate);
  const rows = await db.getAllAsync<any>(
    `SELECT
      ii.product_id,
      ii.product_name,
      SUM(ii.quantity) as total_sold,
      SUM(ii.total) as total_revenue,
      SUM((ii.unit_price - ii.unit_cost) * ii.quantity) as total_profit
    FROM invoice_items ii
    JOIN invoices i ON ii.invoice_id = i.id
    WHERE i.status != 'refunded'
      AND i.created_at >= ?
      AND i.created_at < ?
    GROUP BY ii.product_id, ii.product_name
    ORDER BY total_sold DESC
    LIMIT ?`,
    [start, end, limit]
  );

  return rows;
}

/**
 * Get outstanding balance (partial payments total)
 */
export async function getOutstandingBalance(): Promise<number> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ total: number }>(
    "SELECT COALESCE(SUM(amount_due), 0) as total FROM invoices WHERE status = 'partial'"
  );
  return result?.total || 0;
}

/**
 * Helper: get date string for N days ago
 */
export function getDateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return getLocalDateKey(d);
}

/**
 * Helper: get today's date string
 */
export function getToday(): string {
  return getLocalDateKey();
}
