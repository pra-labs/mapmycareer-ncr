import fs from 'fs';
import path from 'path';

export interface TalentAlertRecord {
  id?: number;
  name: string;
  email: string;
  target_role: string;
  preferred_city: string;
  notice_period: 'Immediate' | '<= 30 Days' | '30-60 Days' | '> 60 Days';
  linkedin_url?: string | null;
  consent_given: boolean;
  consent_timestamp: string;
  consent_version: string;
  created_at?: string;
}

interface DatabaseSyncType {
  prepare: (sql: string) => {
    all: (...params: unknown[]) => unknown[];
    get: (...params: unknown[]) => unknown;
    run: (...params: unknown[]) => { changes: number; lastInsertRowid: number | bigint };
  };
  exec: (sql: string) => void;
  close?: () => void;
}

let alertsDbInstance: DatabaseSyncType | null = null;
let customDbPath: string | null = null;

export function setTalentAlertsDbPath(newPath: string | null): void {
  alertsDbInstance = null;
  customDbPath = newPath;
}

export function resolveTalentAlertsDbPath(): string {
  if (customDbPath) {
    return customDbPath;
  }
  // Primary default: web/data/talent_alerts.db or data/talent_alerts.db depending on CWD
  const cwd = process.cwd();
  const primary = path.join(cwd, 'data', 'talent_alerts.db');
  const webRelative = path.join(cwd, 'web', 'data', 'talent_alerts.db');

  if (fs.existsSync(primary)) {
    return primary;
  }
  if (fs.existsSync(webRelative)) {
    return webRelative;
  }

  // If cwd is inside web, return path.join(cwd, 'data', 'talent_alerts.db')
  if (cwd.endsWith('/web') || cwd.endsWith('\\web')) {
    return primary;
  }
  return webRelative;
}

export function getTalentAlertsDatabase(): DatabaseSyncType | null {
  if (alertsDbInstance) {
    return alertsDbInstance;
  }

  try {
    const dbPath = resolveTalentAlertsDbPath();
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proc = process as any;
    let sqliteModule = typeof proc.getBuiltinModule === 'function'
      ? proc.getBuiltinModule('node:sqlite')
      : null;

    if (!sqliteModule) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        sqliteModule = require('node:sqlite');
      } catch {
        return null;
      }
    }

    if (sqliteModule && typeof sqliteModule.DatabaseSync === 'function') {
      const db = new sqliteModule.DatabaseSync(dbPath) as DatabaseSyncType;
      
      // Initialize isolated talent_alerts table
      db.exec(`
        CREATE TABLE IF NOT EXISTS talent_alerts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          target_role TEXT NOT NULL,
          preferred_city TEXT NOT NULL,
          notice_period TEXT NOT NULL,
          linkedin_url TEXT,
          consent_given INTEGER NOT NULL,
          consent_timestamp TEXT NOT NULL,
          consent_version TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_talent_alerts_email ON talent_alerts(email);
      `);

      alertsDbInstance = db;
      return db;
    }
  } catch (err) {
    console.error('[talent-alerts-db] Initialization error:', err);
  }
  return null;
}

export function insertTalentAlert(record: Omit<TalentAlertRecord, 'id' | 'created_at'>): { success: boolean; id?: number | bigint; error?: string } {
  const db = getTalentAlertsDatabase();
  if (!db) {
    return { success: false, error: 'Database unavailable' };
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO talent_alerts (
        name,
        email,
        target_role,
        preferred_city,
        notice_period,
        linkedin_url,
        consent_given,
        consent_timestamp,
        consent_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      record.name.trim(),
      record.email.trim().toLowerCase(),
      record.target_role.trim(),
      record.preferred_city.trim(),
      record.notice_period,
      record.linkedin_url ? record.linkedin_url.trim() : null,
      record.consent_given ? 1 : 0,
      record.consent_timestamp,
      record.consent_version
    );

    return { success: true, id: result.lastInsertRowid };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}
