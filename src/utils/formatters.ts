// ============================================================
// Utility Functions - Formatters
// ============================================================

/**
 * Format a number as currency
 */
export function formatCurrency(amount: number, currency: string = 'EGP'): string {
  return `${amount.toFixed(2)} ${currency}`;
}

/**
 * Format a date string to localized display
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a date string to time display
 */
export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format a date string to full date and time
 */
export function formatDateTime(dateStr: string): string {
  return `${formatDate(dateStr)} ${formatTime(dateStr)}`;
}

/**
 * Format a number with compact notation (e.g., 1.2K, 3.5M)
 */
export function formatCompact(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toFixed(0);
}

/**
 * Format percentage change with + or - sign
 */
export function formatPercentChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+100%' : '0%';
  const change = ((current - previous) / previous) * 100;
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
}

/**
 * Get relative time string (e.g., "منذ 5 دقائق")
 */
export function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'الآن';
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  if (hours < 24) return `منذ ${hours} ساعة`;
  if (days < 7) return `منذ ${days} يوم`;
  return formatDate(dateStr);
}

/**
 * Generate invoice number with prefix
 */
export function generateInvoiceNumber(sequence: number): string {
  return `INV-${String(sequence).padStart(6, '0')}`;
}
