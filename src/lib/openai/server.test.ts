import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generatePlaceSummary, extractPlaces, DEFAULT_AI_MODEL } from '@/src/lib/openai/server';

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

describe('extractPlaces', () => {
  const items = [
    { type: 'restaurant', name: 'Ichiran', area: 'Tokyo', address: '', cuisine: 'Ramen', category: '', notes: 'go early' },
    { type: 'place', name: 'Senso-ji', area: 'Asakusa, Tokyo', address: '', cuisine: '', category: 'sightseeing', notes: '' },
  ];

  it('parses structured items out of the Responses payload', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, json: async () => respBody(JSON.stringify({ items })),
    })) as unknown as typeof fetch);
    const out = await extractPlaces({ text: 'two spots', images: [] });
    expect(out).toEqual(items);
  });

  it('drops malformed rows (bad type / missing name) but keeps valid ones', async () => {
    const mixed = { items: [
      { type: 'restaurant', name: 'Good', area: '', address: '', cuisine: '', category: '', notes: '' },
      { type: 'nonsense', name: 'Bad type', area: '', address: '', cuisine: '', category: '', notes: '' },
      { type: 'place', name: '', area: '', address: '', cuisine: '', category: '', notes: '' },
    ] };
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => respBody(JSON.stringify(mixed)) })) as unknown as typeof fetch);
    const out = await extractPlaces({ text: 'x', images: [] });
    expect(out.map((i) => i.name)).toEqual(['Good']);
  });

  it('sends multimodal input (input_text + one input_image per data URL) with json_schema format', async () => {
    const f = vi.fn(async (_url: string, _opts: { body: string }) => ({ ok: true, json: async () => respBody(JSON.stringify({ items: [] })) }));
    vi.stubGlobal('fetch', f as unknown as typeof fetch);
    await extractPlaces({ text: 'hi', images: ['data:image/jpeg;base64,AAA', 'data:image/jpeg;base64,BBB'], tripContext: 'Hawaii 2026' });
    const body = JSON.parse(f.mock.calls[0]![1].body);
    expect(body.model).toBe(DEFAULT_AI_MODEL);
    expect(body.text.format.type).toBe('json_schema');
    const content = body.input[0].content;
    expect(content[0]).toEqual({ type: 'input_text', text: expect.stringContaining('Hawaii 2026') });
    const images = content.filter((c: { type: string }) => c.type === 'input_image');
    expect(images.map((c: { image_url: string }) => c.image_url)).toEqual(['data:image/jpeg;base64,AAA', 'data:image/jpeg;base64,BBB']);
  });

  it('returns [] without calling fetch when there is no text and no images', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f as unknown as typeof fetch);
    expect(await extractPlaces({ text: '  ', images: [] })).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });

  it('returns [] when the key is missing', async () => {
    delete process.env.OPENAI_API_KEY;
    expect(await extractPlaces({ text: 'x', images: [] })).toEqual([]);
  });

  it('returns [] on a non-ok response, a throw, or unparseable JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })) as unknown as typeof fetch);
    expect(await extractPlaces({ text: 'x', images: [] })).toEqual([]);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('net'); }) as unknown as typeof fetch);
    expect(await extractPlaces({ text: 'x', images: [] })).toEqual([]);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => respBody('not json') })) as unknown as typeof fetch);
    expect(await extractPlaces({ text: 'x', images: [] })).toEqual([]);
  });
});
