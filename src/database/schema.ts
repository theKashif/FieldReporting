import { db } from './database';

let initializationPromise: Promise<void> | null = null;

async function createTables(): Promise<void> {
  await db.execute(`
    PRAGMA foreign_keys = ON;
  `);

  await db.execute(`
    PRAGMA journal_mode = WAL;
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending', 'uploading', 'uploaded', 'failed')),
      retry_count INTEGER NOT NULL DEFAULT 0,
      next_retry_at TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      uploaded_at TEXT
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS report_images (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      uri TEXT NOT NULL,
      size INTEGER NOT NULL,
      mime_type TEXT NOT NULL,

      FOREIGN KEY(report_id)
        REFERENCES reports(id)
        ON DELETE CASCADE
    );
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_reports_status
    ON reports(status);
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_images_report_id
    ON report_images(report_id);
  `);
}

export function initializeDatabase(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = createTables().catch(error => {
      initializationPromise = null;
      throw error;
    });
  }

  return initializationPromise;
}