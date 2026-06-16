// ============================================================
// Audit Service - immutable trail for sensitive operations
// ============================================================

import { generateId, getDatabase } from '../db/client';
import { getLocalDayBounds } from '../utils/dates';
import type { AuditEvent } from '../types';

export interface LogAuditEventInput {
  userId?: string | null;
  action: AuditEvent['action'];
  entityType: string;
  entityId: string;
  entityLabel?: string | null;
  before?: unknown;
  after?: unknown;
  note?: string | null;
}

function stringify(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export async function logAuditEvent(input: LogAuditEventInput): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO audit_events
      (id, user_id, action, entity_type, entity_id, entity_label, before_json, after_json, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      generateId(),
      input.userId ?? null,
      input.action,
      input.entityType,
      input.entityId,
      input.entityLabel ?? null,
      stringify(input.before),
      stringify(input.after),
      input.note?.trim() || null,
      now,
    ]
  );
}

export async function getRecentAuditEvents(limit = 100): Promise<AuditEvent[]> {
  const db = await getDatabase();
  return db.getAllAsync<AuditEvent>(
    'SELECT * FROM audit_events ORDER BY created_at DESC LIMIT ?',
    [limit]
  );
}

export async function getAuditEventsForDate(dateKey: string): Promise<AuditEvent[]> {
  const db = await getDatabase();
  const [start, end] = getLocalDayBounds(dateKey);

  return db.getAllAsync<AuditEvent>(
    'SELECT * FROM audit_events WHERE created_at >= ? AND created_at < ? ORDER BY created_at DESC',
    [start, end]
  );
}
