// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { getSettings } from '@/src/db/repos/settings';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() { return testHandle.db; },
  sqlite: {},
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { PATCH } from '@/app/api/settings/route';

function req(body: unknown, key?: string) {
  return new Request('http://x/api/settings', {
    method: 'PATCH',
    headers: key ? { 'x-api-key': key } : {},
    body: JSON.stringify(body),
  });
}

describe('PATCH /api/settings', () => {
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
    delete process.env.BURGERGO_API_KEY;
  });
  afterEach(() => {
    delete process.env.BURGERGO_API_KEY;
  });

  it('sets the currency (trimmed + uppercased)', async () => {
    const res = await PATCH(req({ currency: 'eur' }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { settings: { currency: string } };
    expect(json.settings.currency).toBe('EUR');
    expect(getSettings(testHandle.db)?.currency).toBe('EUR');
  });

  it('rejects an invalid currency code with 400', async () => {
    const res = await PATCH(req({ currency: '12' }));
    expect(res.status).toBe(400);
  });

  it('sets and clears the AI overrides (blank → null)', async () => {
    let res = await PATCH(req({ prompt: 'Be concise', model: 'gpt-5.4-mini' }));
    expect(res.status).toBe(200);
    let json = (await res.json()) as { settings: { aiPrompt: string | null; aiModel: string | null } };
    expect(json.settings.aiPrompt).toBe('Be concise');
    expect(json.settings.aiModel).toBe('gpt-5.4-mini');

    res = await PATCH(req({ prompt: '   ', model: '' }));
    json = (await res.json()) as { settings: { aiPrompt: string | null; aiModel: string | null } };
    expect(json.settings.aiPrompt).toBeNull();
    expect(json.settings.aiModel).toBeNull();
  });

  it('a currency-only patch never wipes the AI override', async () => {
    await PATCH(req({ prompt: 'keep me', model: 'gpt-5.4-mini' }));
    const res = await PATCH(req({ currency: 'JPY' }));
    const json = (await res.json()) as { settings: { currency: string; aiPrompt: string | null } };
    expect(json.settings.currency).toBe('JPY');
    expect(json.settings.aiPrompt).toBe('keep me');
  });

  it('enforces the write key when BURGERGO_API_KEY is set', async () => {
    process.env.BURGERGO_API_KEY = 'secret';
    expect((await PATCH(req({ currency: 'USD' }))).status).toBe(401);
    expect((await PATCH(req({ currency: 'USD' }, 'secret'))).status).toBe(200);
  });
});
