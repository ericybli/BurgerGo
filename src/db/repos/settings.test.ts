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
    expect(first).toEqual({ id: 1, language: 'en', currency: 'USD', aiPrompt: null, aiModel: null, clusterPins: null });

    // Second call must NOT overwrite existing values.
    const second = ensureSettings(db, { language: 'zh', currency: 'CNY' });
    expect(second).toEqual({ id: 1, language: 'en', currency: 'USD', aiPrompt: null, aiModel: null, clusterPins: null });

    expect(getSettings(db)).toEqual({ id: 1, language: 'en', currency: 'USD', aiPrompt: null, aiModel: null, clusterPins: null });
  });

  it('updateSettings patches only the provided fields', () => {
    const { db } = makeTestDb();
    ensureSettings(db, { language: 'en', currency: 'USD' });

    const langOnly = updateSettings(db, { language: 'zh' });
    expect(langOnly).toEqual({ id: 1, language: 'zh', currency: 'USD', aiPrompt: null, aiModel: null, clusterPins: null });

    const currOnly = updateSettings(db, { currency: 'JPY' });
    expect(currOnly).toEqual({ id: 1, language: 'zh', currency: 'JPY', aiPrompt: null, aiModel: null, clusterPins: null });
  });

  it('updateSettings on an unseeded db creates the row from the patch + defaults', () => {
    const { db } = makeTestDb();
    const row = updateSettings(db, { currency: 'EUR' });
    // Falls back to language 'en' when seeding via a partial patch.
    expect(row).toEqual({ id: 1, language: 'en', currency: 'EUR', aiPrompt: null, aiModel: null, clusterPins: null });
  });

  it('updateSettings sets + clears the AI prompt/model without touching language/currency', () => {
    const { db } = makeTestDb();
    ensureSettings(db, { language: 'zh', currency: 'CNY' });

    const set = updateSettings(db, { aiPrompt: 'my prompt', aiModel: 'gpt-4o-mini' });
    expect(set).toMatchObject({ language: 'zh', currency: 'CNY', aiPrompt: 'my prompt', aiModel: 'gpt-4o-mini' });

    // A currency-only change must NOT wipe the AI overrides.
    const keep = updateSettings(db, { currency: 'USD' });
    expect(keep).toMatchObject({ aiPrompt: 'my prompt', aiModel: 'gpt-4o-mini' });

    // null clears the override.
    const cleared = updateSettings(db, { aiPrompt: null, aiModel: null });
    expect(cleared.aiPrompt).toBeNull();
    expect(cleared.aiModel).toBeNull();
  });

  it('updateSettings toggles clusterPins without touching other fields; null = default', () => {
    const { db } = makeTestDb();
    ensureSettings(db, { language: 'en', currency: 'USD' });
    expect(getSettings(db)?.clusterPins).toBeNull(); // unset = default (on)

    const off = updateSettings(db, { clusterPins: false });
    expect(off.clusterPins).toBe(false);

    // An unrelated change must NOT wipe the clustering preference.
    const keep = updateSettings(db, { currency: 'EUR' });
    expect(keep.clusterPins).toBe(false);
    expect(keep.currency).toBe('EUR');

    const on = updateSettings(db, { clusterPins: true });
    expect(on.clusterPins).toBe(true);

    // null restores the default sentinel.
    const reset = updateSettings(db, { clusterPins: null });
    expect(reset.clusterPins).toBeNull();
  });
});
