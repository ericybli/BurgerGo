import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/src/db/schema';
import { seedOwners } from '@/src/db/repos/seedOwners';

/**
 * Boot-time owner seeding: every trip without an owner membership gets one for
 * BURGERGO_OWNER_EMAIL. Idempotent; skips (with a warning) when the env is
 * unset. Runs in docker-entrypoint.sh AFTER migrations (the tables must exist).
 */
const email = process.env.BURGERGO_OWNER_EMAIL;
if (!email) {
  // eslint-disable-next-line no-console
  console.warn('burgergo: BURGERGO_OWNER_EMAIL unset — skipping owner seed');
  process.exit(0);
}

// Imported lazily (mirrors scripts/migrate.ts) so the skip path above never
// triggers env validation — an empty BURGERGO_OWNER_EMAIL would fail z.email().
void import('@/src/env').then(({ env }) => {
  mkdirSync(dirname(env.DATABASE_PATH), { recursive: true });
  const sqlite = new Database(env.DATABASE_PATH);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  try {
    // `{ schema }` matches makeTestDb(), so this is exactly TestDb['db'] — the
    // Db type every repo (incl. seedOwners) takes. No cast needed.
    const db = drizzle(sqlite, { schema });
    const added = seedOwners(db, email);
    // eslint-disable-next-line no-console
    console.log(`burgergo: owner seed done (${added} trip(s) adopted)`);
  } finally {
    sqlite.close();
  }
});
