import { it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generatePlaceSummary } from '@/src/lib/openai/server';

const OLD = process.env.OPENAI_API_KEY;
afterEach(() => { process.env.OPENAI_API_KEY = OLD; vi.restoreAllMocks(); vi.unstubAllGlobals(); });
beforeEach(() => { process.env.OPENAI_API_KEY = 'sk-test'; });

const input = { name: 'Senso-ji', address: 'Asakusa', category: 'sightseeing',
  tripName: 'Tokyo', startDate: '2026-09-04', endDate: '2026-09-12' };

it('returns the model text on success', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: '  A historic temple.  ' } }] }),
  })) as unknown as typeof fetch);
  expect(await generatePlaceSummary(input)).toBe('A historic temple.');
});

it('returns null when the key is missing', async () => {
  delete process.env.OPENAI_API_KEY;
  const f = vi.fn();
  vi.stubGlobal('fetch', f as unknown as typeof fetch);
  expect(await generatePlaceSummary(input)).toBeNull();
  expect(f).not.toHaveBeenCalled();
});

it('returns null on a non-ok response', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) })) as unknown as typeof fetch);
  expect(await generatePlaceSummary(input)).toBeNull();
});

it('returns null when fetch throws', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network'); }) as unknown as typeof fetch);
  expect(await generatePlaceSummary(input)).toBeNull();
});
