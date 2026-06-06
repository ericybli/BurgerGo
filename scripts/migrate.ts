import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const MIGRATIONS_FOLDER = resolve(process.cwd(), 'drizzle');

export interface SettingsSeed {
  language: 'en' | 'zh';
  currency: string;
}

/**
 * Apply all pending Drizzle migrations to the SQLite file at `databasePath`,
 * then idempotently seed the single global settings row (id=1).
 * Pure and side-effect-scoped: opens, migrates, seeds, closes.
 */
export function runMigrations(
  databasePath: string,
  seed: SettingsSeed = { language: 'en', currency: 'USD' },
): void {
  mkdirSync(dirname(databasePath), { recursive: true });
  const sqlite = new Database(databasePath);
  sqlite.pragma('journal_mode = WAL');
  try {
    const db = drizzle(sqlite);
    migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    // Seed the single settings row only if absent (id is fixed at 1).
    sqlite
      .prepare(
        `INSERT OR IGNORE INTO settings (id, language, currency) VALUES (1, ?, ?)`,
      )
      .run(seed.language, seed.currency);
  } finally {
    sqlite.close();
  }
}

// CLI entrypoint: only runs when executed directly (e.g. node scripts/migrate.js).
const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  // Imported lazily so test imports of runMigrations never trigger env validation.
  void import('@/src/env').then(({ env }) => {
    runMigrations(env.DATABASE_PATH, {
      language: env.DEFAULT_LANGUAGE,
      currency: env.DEFAULT_CURRENCY,
    });
    // eslint-disable-next-line no-console
    console.log(`migrations applied to ${env.DATABASE_PATH}`);
  });
}
