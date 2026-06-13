// ============================================================
// Print Service - print invoices & export them as PDF
// ============================================================

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { buildReceiptHtml } from '../utils/receipt';
import { getInvoiceWithItems } from './invoiceService';
import { generateInvoiceNumber } from '../utils/formatters';
import { useSettingsStore } from '../stores/settingsStore';
import { useAuthStore } from '../stores/authStore';
import type { Invoice, InvoiceItem } from '../types';

// Resolve the receipt HTML for a given invoice id (loads from DB).
async function resolveHtml(invoiceId: string): Promise<string> {
  const data = await getInvoiceWithItems(invoiceId);
  if (!data) throw new Error('Invoice not found');
  return buildHtmlFor(data.invoice, data.items);
}

// Build HTML directly from already-loaded invoice + items.
export function buildHtmlFor(invoice: Invoice, items: InvoiceItem[]): string {
  const settings = useSettingsStore.getState().settings;
  const user = useAuthStore.getState().user;
  return buildReceiptHtml({
    invoice,
    items,
    settings,
    cashierName: user?.name,
  });
}

/**
 * Open the native print dialog for an invoice.
 * Accepts either a loaded invoice (+items) or an invoice id.
 */
export async function printInvoice(
  source: string | { invoice: Invoice; items: InvoiceItem[] }
): Promise<void> {
  const html = typeof source === 'string' ? await resolveHtml(source) : buildHtmlFor(source.invoice, source.items);
  await Print.printAsync({ html });
}

/**
 * Export an invoice to a PDF file and open the share sheet.
 * Returns the local file uri of the generated PDF.
 */
export async function shareInvoicePdf(
  source: string | { invoice: Invoice; items: InvoiceItem[] }
): Promise<string> {
  const { invoice, items } =
    typeof source === 'string'
      ? (await getInvoiceWithItems(source)) ?? (() => { throw new Error('Invoice not found'); })()
      : source;

  const html = buildHtmlFor(invoice, items);
  const { uri } = await Print.printToFileAsync({ html });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare && Platform.OS !== 'web') {
    await Sharing.shareAsync(uri, {
      UTI: 'com.adobe.pdf',
      mimeType: 'application/pdf',
      dialogTitle: `فاتورة ${invoice.invoice_name || generateInvoiceNumber(invoice.invoice_number)}`,
    });
  }

  return uri;
}
