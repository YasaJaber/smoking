// ============================================================
// Backup Service - SQLite export / backup / restore
// ============================================================

import * as SQLite from 'expo-sqlite';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { File } from 'expo-file-system';
import { DB_NAME } from '../constants/config';
import { closeDatabase, getDatabase, initializeDatabase } from '../db/client';
import { logAuditEvent } from './auditService';

export interface BackupResult {
  name: string;
  uri: string;
}

const BACKUP_DIR_NAME = 'sqlite-backups';

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function getBackupDirectory(): Promise<string> {
  if (!FileSystem.documentDirectory) {
    throw new Error('DOCUMENT_DIRECTORY_UNAVAILABLE');
  }

  const dir = `${FileSystem.documentDirectory}${BACKUP_DIR_NAME}/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
  return dir;
}

export async function createDatabaseBackup(userId?: string | null): Promise<BackupResult> {
  const source = await getDatabase();
  const backupDir = await getBackupDirectory();
  const name = `smoking-pos-${timestamp()}.db`;
  const dest = await SQLite.openDatabaseAsync(name, { useNewConnection: true }, backupDir);

  try {
    await SQLite.backupDatabaseAsync({
      sourceDatabase: source,
      destDatabase: dest,
    });
  } finally {
    await dest.closeAsync();
  }

  const result = { name, uri: `${backupDir}${name}` };
  await logAuditEvent({
    userId,
    action: 'backup',
    entityType: 'database',
    entityId: name,
    entityLabel: name,
    after: result,
  });

  return result;
}

export async function shareDatabaseBackup(userId?: string | null): Promise<BackupResult> {
  const backup = await createDatabaseBackup(userId);
  const available = await Sharing.isAvailableAsync();

  if (available) {
    await Sharing.shareAsync(backup.uri, {
      mimeType: 'application/vnd.sqlite3',
      dialogTitle: 'تصدير قاعدة بيانات Smoking POS',
      UTI: 'public.database',
    });
  }

  return backup;
}

export async function restoreDatabaseFromPickedFile(userId?: string | null): Promise<BackupResult> {
  const picked = await File.pickFileAsync(undefined, 'application/vnd.sqlite3');
  const file = Array.isArray(picked) ? picked[0] : picked;

  if (!file?.uri) {
    throw new Error('NO_FILE_SELECTED');
  }

  const backupDir = await getBackupDirectory();
  const restoreName = `restore-${timestamp()}.db`;
  const restoreUri = `${backupDir}${restoreName}`;
  const existing = await FileSystem.getInfoAsync(restoreUri);

  if (existing.exists) {
    await FileSystem.deleteAsync(restoreUri, { idempotent: true });
  }

  await FileSystem.copyAsync({ from: file.uri, to: restoreUri });

  await closeDatabase();
  const source = await SQLite.openDatabaseAsync(restoreName, { useNewConnection: true }, backupDir);
  const dest = await SQLite.openDatabaseAsync(DB_NAME, { useNewConnection: true });

  try {
    await SQLite.backupDatabaseAsync({
      sourceDatabase: source,
      destDatabase: dest,
    });
  } finally {
    await source.closeAsync();
    await dest.closeAsync();
  }

  await initializeDatabase();
  const result = { name: restoreName, uri: restoreUri };
  await logAuditEvent({
    userId,
    action: 'restore',
    entityType: 'database',
    entityId: restoreName,
    entityLabel: restoreName,
    after: result,
  });

  return result;
}
