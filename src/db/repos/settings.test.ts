import { describe, it, expect } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import {
  getSettings,
  ensureSettings,
  updateSettings,
} from '@/src/db/repos/settings';

describe('settings repo', () => {
  it('getSettings returns undefined on an unseeded db', () => {
    const { db } = makeTestDb();
    expect(getSettings(db)).toBeUndefined();
  });

  it('ensureSettings inserts the id=1 row once and is idempotent', () => {
    const { db } = makeTestDb();
    const first = ensureSettings(db, { language: 'en', currency: 'USD' });
    expect(first).toEqual({ id: 1, language: 'en', currency: 'USD' });

    // Second call must NOT overwrite existing values.
    const second = ensureSettings(db, { language: 'zh', currency: 'CNY' });
    expect(second).toEqual({ id: 1, language: 'en', currency: 'USD' });

    expect(getSettings(db)).toEqual({ id: 1, language: 'en', currency: 'USD' });
  });

  it('updateSettings patches only the provided fields', () => {
    const { db } = makeTestDb();
    ensureSettings(db, { language: 'en', currency: 'USD' });

    const langOnly = updateSettings(db, { language: 'zh' });
    expect(langOnly).toEqual({ id: 1, language: 'zh', currency: 'USD' });

    const currOnly = updateSettings(db, { currency: 'JPY' });
    expect(currOnly).toEqual({ id: 1, language: 'zh', currency: 'JPY' });
  });

  it('updateSettings on an unseeded db creates the row from the patch + defaults', () => {
    const { db } = makeTestDb();
    const row = updateSettings(db, { currency: 'EUR' });
    // Falls back to language 'en' when seeding via a partial patch.
    expect(row).toEqual({ id: 1, language: 'en', currency: 'EUR' });
  });
});
