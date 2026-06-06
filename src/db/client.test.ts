import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'burgergo-client-'));
  process.env.DATABASE_PATH = join(tmpDir, 'test.db');
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('db client singleton', () => {
  it('opens better-sqlite3 in WAL mode and exposes db + sqlite', async () => {
    const { db, sqlite } = await import('@/src/db/client');
    const mode = sqlite.pragma('journal_mode', { simple: true });
    expect(String(mode).toLowerCase()).toBe('wal');

    const row = db.get<{ one: number }>(sql`SELECT 1 as one`);
    expect(row.one).toBe(1);
  });

  it('returns the same instance on re-import (singleton)', async () => {
    const a = await import('@/src/db/client');
    const b = await import('@/src/db/client');
    expect(a.db).toBe(b.db);
    expect(a.sqlite).toBe(b.sqlite);
  });
});
