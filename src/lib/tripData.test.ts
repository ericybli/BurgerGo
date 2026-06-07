import { describe, it, expect, vi, afterEach } from 'vitest';

/** A manually-resolvable promise so we can hold a fetch "in flight". */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_BASE_PATH;
  vi.resetModules();
});

describe('fetchTripData (request coalescing)', () => {
  it('coalesces concurrent callers into a single fetch and shares the result', async () => {
    const { fetchTripData } = await import('./tripData');
    const d = deferred<{ ok: boolean; status: number; json: () => Promise<unknown> }>();
    const fetchMock = vi.fn(() => d.promise);
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    // Two callers (the shell + the active tab) fire before the request settles.
    const p1 = fetchTripData('trip-1');
    const p2 = fetchTripData('trip-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/trips/trip-1', { credentials: 'same-origin' });

    const body = { trip: { id: 'trip-1', name: 'Osaka' } };
    d.resolve({ ok: true, status: 200, json: async () => body });
    await expect(p1).resolves.toEqual(body);
    await expect(p2).resolves.toEqual(body);
  });

  it('re-fetches once the previous request has settled (no stale caching)', async () => {
    const { fetchTripData } = await import('./tripData');
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ trip: { id: 'trip-1' } }) }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    await fetchTripData('trip-1');
    await fetchTripData('trip-1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects all concurrent callers on a non-ok response and clears the in-flight entry', async () => {
    const { fetchTripData } = await import('./tripData');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ trip: { id: 'trip-1' } }) });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    await expect(fetchTripData('trip-1')).rejects.toBeInstanceOf(Error);
    // In-flight entry cleared on settle → a retry actually re-fetches.
    await expect(fetchTripData('trip-1')).resolves.toEqual({ trip: { id: 'trip-1' } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('prefixes the configured base path', async () => {
    process.env.NEXT_PUBLIC_BASE_PATH = '/burgergo';
    const { fetchTripData } = await import('./tripData');
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ trip: {} }) }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
    await fetchTripData('trip-9');
    expect(fetchMock).toHaveBeenCalledWith('/burgergo/api/trips/trip-9', { credentials: 'same-origin' });
  });
});
