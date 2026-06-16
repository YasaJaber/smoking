// ============================================================
// Receipt HTML generator - builds printable/PDF invoice markup
// ============================================================

import type { Invoice, InvoiceItem, Settings } from '../types';
import { formatCurrency, formatDateTime, formatInvoiceCode } from './formatters';

interface ReceiptData {
  invoice: Invoice;
  items: InvoiceItem[];
  settings: Settings;
  cashierName?: string;
}

// Escape user-provided strings so they can't break the HTML layout
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Build an 80mm thermal-receipt style HTML document for an invoice.
 * Designed to look good both when printed and exported to PDF.
 */
export function buildReceiptHtml({ invoice, items, settings, cashierName }: ReceiptData): string {
  const currency = settings.currency || 'EGP';
  const calculatedTotal = invoice.subtotal + invoice.tax_amount;
  const priceAdjustment = invoice.total - calculatedTotal;
  const hasPriceAdjustment = Math.abs(priceAdjustment) > 0.005;

  const itemsRows = items
    .map(
      (item) => `
        <tr>
          <td class="name">${escapeHtml(item.product_name)}</td>
          <td class="qty">${item.quantity}</td>
          <td class="price">${formatCurrency(item.unit_price, currency)}</td>
          <td class="total">${formatCurrency(item.total, currency)}</td>
        </tr>`
    )
    .join('');

  const taxRow = settings.tax_enabled
    ? `
      <div class="row">
        <span>الضريبة (${(settings.tax_rate * 100).toFixed(0)}%)</span>
        <span>${formatCurrency(invoice.tax_amount, currency)}</span>
      </div>`
    : '';

  const priceAdjustmentRow = hasPriceAdjustment
    ? `
      <div class="row ${priceAdjustment < 0 ? 'discount' : 'adjustment'}">
        <span>${priceAdjustment < 0 ? 'خصم' : 'تعديل سعر'}</span>
        <span>${priceAdjustment < 0 ? '-' : '+'}${formatCurrency(Math.abs(priceAdjustment), currency)}</span>
      </div>`
    : '';

  const dueRow =
    invoice.amount_due > 0
      ? `
      <div class="row due">
        <span>المتبقي</span>
        <span>${formatCurrency(invoice.amount_due, currency)}</span>
      </div>`
      : '';

  const statusLabel =
    invoice.status === 'partial'
      ? 'دفع جزئي'
      : invoice.status === 'refunded'
      ? 'مرتجع'
      : 'مدفوعة';

  const phoneLine = settings.phone
    ? `<div class="store-phone">${escapeHtml(settings.phone)}</div>`
    : '';

  const welcomeLine = settings.welcome_message
    ? `<div class="welcome">${escapeHtml(settings.welcome_message)}</div>`
    : '';

  const footerLine = settings.footer_message
    ? `<div class="footer-msg">${escapeHtml(settings.footer_message)}</div>`
    : '';

  const invoiceNameLine = invoice.invoice_name
    ? `<div class="row"><span>اسم الفاتورة</span><span>${escapeHtml(invoice.invoice_name)}</span></div>`
    : '';
  const merchantNameLine = invoice.merchant_name
    ? `<div class="row"><span>اسم التاجر</span><span>${escapeHtml(invoice.merchant_name)}</span></div>`
    : '';
  const merchantPhoneLine = invoice.merchant_phone
    ? `<div class="row"><span>تليفون التاجر</span><span>${escapeHtml(invoice.merchant_phone)}</span></div>`
    : '';

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    @page { margin: 0; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      margin: 0;
      padding: 16px;
      color: #111;
      width: 320px;
      margin: 0 auto;
    }
    .store-name { font-size: 22px; font-weight: 800; text-align: center; }
    .store-phone { font-size: 12px; text-align: center; color: #555; margin-top: 2px; }
    .welcome { font-size: 12px; text-align: center; color: #555; margin-top: 6px; }
    .divider { border: none; border-top: 1px dashed #999; margin: 12px 0; }
    .meta { font-size: 12px; color: #333; }
    .meta .row { display: flex; justify-content: space-between; margin: 3px 0; }
    .status {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      background: #ecfdf5;
      color: #059669;
    }
    .status.partial { background: #fffbeb; color: #d97706; }
    .status.refunded { background: #fef2f2; color: #dc2626; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
    th {
      text-align: right;
      border-bottom: 1px solid #000;
      padding: 6px 2px;
      font-size: 11px;
    }
    th.qty, th.price, th.total, td.qty, td.price, td.total { text-align: center; }
    th.total, td.total { text-align: left; }
    td { padding: 5px 2px; border-bottom: 1px dashed #ddd; vertical-align: top; }
    td.name { font-weight: 600; }
    .totals { margin-top: 10px; font-size: 13px; }
    .totals .row { display: flex; justify-content: space-between; margin: 4px 0; }
    .totals .grand {
      font-size: 17px;
      font-weight: 800;
      border-top: 2px solid #000;
      padding-top: 8px;
      margin-top: 8px;
    }
    .totals .discount { color: #059669; font-weight: 700; }
    .totals .adjustment { color: #d97706; font-weight: 700; }
    .totals .due { color: #dc2626; font-weight: 700; }
    .footer-msg { text-align: center; font-size: 13px; font-weight: 600; margin-top: 14px; }
    .thanks { text-align: center; font-size: 11px; color: #888; margin-top: 6px; }
  </style>
</head>
<body>
  <div class="store-name">${escapeHtml(settings.store_name || 'محل')}</div>
  ${phoneLine}
  ${welcomeLine}

  <hr class="divider" />

  <div class="meta">
    ${invoiceNameLine}
    ${merchantNameLine}
    ${merchantPhoneLine}
    <div class="row"><span>رقم الفاتورة</span><span>${formatInvoiceCode(invoice.invoice_number, invoice.invoice_code)}</span></div>
    <div class="row"><span>التاريخ</span><span>${formatDateTime(invoice.created_at)}</span></div>
    ${cashierName ? `<div class="row"><span>الكاشير</span><span>${escapeHtml(cashierName)}</span></div>` : ''}
    <div class="row"><span>الحالة</span><span class="status ${invoice.status}">${statusLabel}</span></div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="name">الصنف</th>
        <th class="qty">كمية</th>
        <th class="price">السعر</th>
        <th class="total">الإجمالي</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
    </tbody>
  </table>

  <div class="totals">
    <div class="row"><span>المجموع الفرعي</span><span>${formatCurrency(invoice.subtotal, currency)}</span></div>
    ${taxRow}
    ${priceAdjustmentRow}
    <div class="row grand"><span>الإجمالي النهائي</span><span>${formatCurrency(invoice.total, currency)}</span></div>
    <div class="row"><span>المدفوع</span><span>${formatCurrency(invoice.amount_paid, currency)}</span></div>
    ${dueRow}
  </div>

  <hr class="divider" />

  ${footerLine}
  <div class="thanks">${escapeHtml(settings.store_name || '')}</div>
</body>
</html>`;
}
