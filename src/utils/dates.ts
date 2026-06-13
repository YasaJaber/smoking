// ============================================================
// Date Utilities - local calendar days
// ============================================================

export function getLocalDateKey(date: Date = new Date()): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function getLocalDayBounds(dateKey: string): [string, string] {
  const [year, month, day] = dateKey.split('-').map(Number);
  const start = new Date(year, month - 1, day);
  const end = new Date(year, month - 1, day + 1);

  return [start.toISOString(), end.toISOString()];
}

export function getMillisecondsUntilNextLocalDay(date: Date = new Date()): number {
  const nextDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return Math.max(0, nextDay.getTime() - date.getTime());
}
