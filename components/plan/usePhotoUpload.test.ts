import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePhotoUpload } from './usePhotoUpload';

const file = new File([new Uint8Array(10)], 'p.jpg', { type: 'image/jpeg' });

beforeEach(() => { vi.restoreAllMocks(); });

describe('usePhotoUpload', () => {
  it('POSTs multipart FormData to withBase(/api/photos) and returns the photo on success', async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ photo: { id: 'ph1', width: 1600, height: 800 } }),
      { status: 201, headers: { 'content-type': 'application/json' } },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => usePhotoUpload());
    let returned: unknown;
    await act(async () => {
      returned = await result.current.upload({ file, tripId: 't1', ownerId: 'place-1' });
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callArgs = fetchMock.mock.calls[0] as unknown as [string, any];
    const [url, init] = callArgs;
    expect(url).toBe('/api/photos'); // BASE_PATH='' in tests
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    const fd = init.body as FormData;
    expect(fd.get('tripId')).toBe('t1');
    expect(fd.get('ownerType')).toBe('place');
    expect(fd.get('ownerId')).toBe('place-1');
    expect(fd.get('image')).toBeInstanceOf(File);
    expect(returned).toEqual({ id: 'ph1', width: 1600, height: 800 });
    expect(result.current.uploading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets error and returns null when the server rejects', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'too_large' }), { status: 413 })));
    const { result } = renderHook(() => usePhotoUpload());
    let returned: unknown = 'sentinel';
    await act(async () => {
      returned = await result.current.upload({ file, tripId: 't1', ownerId: 'place-1' });
    });
    expect(returned).toBeNull();
    await waitFor(() => expect(result.current.error).toBe('too_large'));
  });

  it('sets a generic error when fetch throws (offline)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const { result } = renderHook(() => usePhotoUpload());
    let returned: unknown = 'sentinel';
    await act(async () => {
      returned = await result.current.upload({ file, tripId: 't1', ownerId: 'place-1' });
    });
    expect(returned).toBeNull();
    await waitFor(() => expect(result.current.error).toBe('network'));
  });
});
