import { eq } from 'drizzle-orm';
import type { TestDb } from '@/src/db/testDb';
import { settings, type Settings } from '@/src/db/schema';

type Db = TestDb['db'];

const SETTINGS_ID = 1;

export interface SettingsInput {
  language: 'en' | 'zh';
  currency: string;
}

export type SettingsPatch = Partial<SettingsInput>;

/** Read the single global settings row, or undefined if not yet seeded. */
export function getSettings(db: Db): Settings | undefined {
  return db.select().from(settings).where(eq(settings.id, SETTINGS_ID)).get();
}

/**
 * Insert the id=1 settings row if absent; never overwrite existing values.
 * Always returns the current row.
 */
export function ensureSettings(db: Db, input: SettingsInput): Settings {
  const existing = getSettings(db);
  if (existing) return existing;
  db.insert(settings)
    .values({ id: SETTINGS_ID, language: input.language, currency: input.currency })
    .run();
  return getSettings(db) as Settings;
}

/**
 * Patch the provided fields on the id=1 row. If the row does not exist yet,
 * it is created, filling any missing field with a sensible default
 * (language 'en', currency 'USD').
 */
export function updateSettings(db: Db, patch: SettingsPatch): Settings {
  const existing = getSettings(db);
  if (!existing) {
    return ensureSettings(db, {
      language: patch.language ?? 'en',
      currency: patch.currency ?? 'USD',
    });
  }
  const next: SettingsInput = {
    language: patch.language ?? existing.language,
    currency: patch.currency ?? existing.currency,
  };
  db.update(settings)
    .set({ language: next.language, currency: next.currency })
    .where(eq(settings.id, SETTINGS_ID))
    .run();
  return getSettings(db) as Settings;
}
