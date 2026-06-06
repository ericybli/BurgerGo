import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '@/src/db/schema';

const MIGRATIONS_FOLDER = resolve(process.cwd(), 'drizzle');

export interface TestDb {
  db: ReturnType<typeof drizzle<typeof schema>>;
  sqlite: Database.Database;
}

/**
 * Build a fresh, isolated in-memory database with all committed Drizzle
 * migrations applied. Repos take `db` as their first argument, so tests pass
 * this instance directly. Foreign keys are enabled to mirror production.
 */
export function makeTestDb(): TestDb {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return { db, sqlite };
}
