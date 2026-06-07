import { it, expect, afterEach, vi } from 'vitest';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { fetchAndStoreGooglePhoto } from '@/src/lib/google/photo';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function tmp(): string {
  return mkdtempSync(join(tmpdir(), 'bg-gphoto-'));
}

/** A real, valid PNG buffer so sharp can re-encode it. */
async function pngBytes(): Promise<ArrayBuffer> {
  const buf = await sharp({
    create: { width: 8, height: 8, channels: 3, background: { r: 10, g: 20, b: 30 } },
  }).png().toBuffer();
  // A standalone ArrayBuffer (not a slice of a pooled buffer) for fetch's contract.
  return new Uint8Array(buf).buffer;
}

function stubFetchOk(body: ArrayBuffer) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => body })) as unknown as typeof fetch);
}

it('downloads, re-encodes to webp, and returns the uploads-relative path', async () => {
  stubFetchOk(await pngBytes());
  const dir = tmp();
  try {
    const rel = await fetchAndStoreGooglePhoto({ photoRef: 'ref', googlePlaceId: 'ChIJ_abc-123', apiKey: 'k', uploadsDir: dir });
    expect(rel).toBe('gphotos/ChIJ_abc-123.webp');
    expect(existsSync(join(dir, rel!))).toBe(true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it('passes the photo_reference + key to the Place Photo endpoint', async () => {
  const f = vi.fn(async (_url: string) => ({ ok: true, arrayBuffer: async () => pngBytes() }));
  vi.stubGlobal('fetch', f as unknown as typeof fetch);
  const dir = tmp();
  try {
    await fetchAndStoreGooglePhoto({ photoRef: 'REF123', googlePlaceId: 'x', apiKey: 'SECRET', uploadsDir: dir });
    const url = f.mock.calls[0]![0];
    expect(url).toContain('maps.googleapis.com/maps/api/place/photo');
    expect(url).toContain('photo_reference=REF123');
    expect(url).toContain('key=SECRET');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it('sanitizes unsafe characters in the place id for the filename', async () => {
  stubFetchOk(await pngBytes());
  const dir = tmp();
  try {
    const rel = await fetchAndStoreGooglePhoto({ photoRef: 'ref', googlePlaceId: 'a/b:c d', apiKey: 'k', uploadsDir: dir });
    expect(rel).toBe('gphotos/a_b_c_d.webp');
    expect(existsSync(join(dir, rel!))).toBe(true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it('returns null on a non-ok response', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403, arrayBuffer: async () => new ArrayBuffer(0) })) as unknown as typeof fetch);
  const dir = tmp();
  try {
    expect(await fetchAndStoreGooglePhoto({ photoRef: 'r', googlePlaceId: 'x', apiKey: 'k', uploadsDir: dir })).toBeNull();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it('returns null on an empty body', async () => {
  stubFetchOk(new ArrayBuffer(0));
  const dir = tmp();
  try {
    expect(await fetchAndStoreGooglePhoto({ photoRef: 'r', googlePlaceId: 'x', apiKey: 'k', uploadsDir: dir })).toBeNull();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it('returns null when fetch throws', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network'); }) as unknown as typeof fetch);
  const dir = tmp();
  try {
    expect(await fetchAndStoreGooglePhoto({ photoRef: 'r', googlePlaceId: 'x', apiKey: 'k', uploadsDir: dir })).toBeNull();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
