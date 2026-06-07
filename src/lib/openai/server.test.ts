import { it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generatePlaceSummary, DEFAULT_AI_MODEL } from '@/src/lib/openai/server';

const OLD = process.env.OPENAI_API_KEY;
afterEach(() => { process.env.OPENAI_API_KEY = OLD; vi.restoreAllMocks(); vi.unstubAllGlobals(); });
beforeEach(() => { process.env.OPENAI_API_KEY = 'sk-test'; });

const input = { name: 'Senso-ji', address: 'Asakusa', category: 'sightseeing',
  tripName: 'Tokyo', startDate: '2026-09-04', endDate: '2026-09-12' };

// A Responses API payload: text lives at output[]→message→content[]→output_text.
const respBody = (text: string) => ({
  output: [
    { type: 'reasoning', content: [] },
    { type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] },
  ],
});

it('returns the model text from the Responses API output', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => respBody('  一座历史悠久的寺庙。  '),
  })) as unknown as typeof fetch);
  expect(await generatePlaceSummary(input)).toBe('一座历史悠久的寺庙。');
});

it('calls /v1/responses with the default model + reasoning effort, and overridable model/prompt', async () => {
  const f = vi.fn(async (_url: string, _opts: { body: string }) => ({
    ok: true, json: async () => respBody('ok'),
  }));
  vi.stubGlobal('fetch', f as unknown as typeof fetch);

  await generatePlaceSummary(input);
  expect(f.mock.calls[0]![0]).toBe('https://api.openai.com/v1/responses');
  const body1 = JSON.parse(f.mock.calls[0]![1].body);
  expect(body1.model).toBe(DEFAULT_AI_MODEL);
  expect(body1.reasoning).toEqual({ effort: 'low' }); // gpt-5* is a reasoning model
  expect(typeof body1.instructions).toBe('string');
  expect(body1.input).toContain('Senso-ji');

  // Custom model (gpt-4*) → no reasoning param; custom prompt → instructions.
  await generatePlaceSummary({ ...input, model: 'gpt-4o-mini', prompt: 'CUSTOM' });
  const body2 = JSON.parse(f.mock.calls[1]![1].body);
  expect(body2.model).toBe('gpt-4o-mini');
  expect(body2.reasoning).toBeUndefined();
  expect(body2.instructions).toBe('CUSTOM');
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
