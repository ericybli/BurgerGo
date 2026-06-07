import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { ensureSettings } from '@/src/db/repos/settings';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() {
    return testHandle.db;
  },
  sqlite: {},
}));

import { GET } from '@/app/api/settings/route';

describe('GET /api/settings', () => {
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
  });

  it('returns 200 with the seeded settings row', async () => {
    ensureSettings(testHandle.db, { language: 'zh', currency: 'JPY' });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ id: 1, language: 'zh', currency: 'JPY', aiPrompt: null, aiModel: null });
  });

  it('returns 200 with null when settings are not yet seeded', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toBeNull();
  });
});
