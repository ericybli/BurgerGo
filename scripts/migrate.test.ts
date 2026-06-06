import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { runMigrations } from './migrate';

let tmpDir: string;
let dbPath: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'burgergo-migrate-'));
  dbPath = join(tmpDir, 'm.db');
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('runMigrations', () => {
  it('creates all five Phase-1 tables on a fresh db', () => {
    runMigrations(dbPath);
    const raw = new Database(dbPath, { readonly: true });
    const names = raw
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
      .all()
      .map((r) => (r as { name: string }).name);
    raw.close();
    for (const t of [
      'trips',
      'places',
      'travel_legs',
      'place_details_cache',
      'settings',
    ]) {
      expect(names).toContain(t);
    }
  });

  it('seeds exactly one settings row (id=1) from defaults', () => {
    runMigrations(dbPath, { language: 'en', currency: 'USD' });
    const raw = new Database(dbPath, { readonly: true });
    const rows = raw.prepare(`SELECT id, language, currency FROM settings`).all();
    raw.close();
    expect(rows).toEqual([{ id: 1, language: 'en', currency: 'USD' }]);
  });

  it('is idempotent — re-running does not duplicate the settings row', () => {
    runMigrations(dbPath, { language: 'en', currency: 'USD' });
    runMigrations(dbPath, { language: 'zh', currency: 'CNY' });
    const raw = new Database(dbPath, { readonly: true });
    const rows = raw.prepare(`SELECT id, language, currency FROM settings`).all();
    raw.close();
    // Seed only inserts when absent; the second run is a no-op for settings.
    expect(rows).toEqual([{ id: 1, language: 'en', currency: 'USD' }]);
  });
});
