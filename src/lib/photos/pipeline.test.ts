import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  SIZES,
  MAX_UPLOAD_BYTES,
  validateUpload,
  processPhoto,
} from '@/src/lib/photos/pipeline';

let uploadsDir: string;

beforeAll(() => {
  uploadsDir = mkdtempSync(join(tmpdir(), 'burgergo-photos-'));
});
afterAll(() => {
  rmSync(uploadsDir, { recursive: true, force: true });
});

// A real 2000x1000 JPEG so resize math is exercised end-to-end.
async function sampleJpeg(): Promise<Buffer> {
  return sharp({
    create: { width: 2000, height: 1000, channels: 3, background: { r: 200, g: 100, b: 50 } },
  })
    .jpeg()
    .toBuffer();
}

describe('validateUpload', () => {
  it('accepts an image/* content type within the size cap', () => {
    expect(validateUpload({ contentType: 'image/jpeg', byteLength: 1000 })).toEqual({ ok: true });
  });

  it('rejects a non-image content type', () => {
    const r = validateUpload({ contentType: 'application/pdf', byteLength: 1000 });
    expect(r).toEqual({ ok: false, reason: 'not_image' });
  });

  it('rejects an empty/missing content type', () => {
    expect(validateUpload({ contentType: '', byteLength: 1000 })).toEqual({ ok: false, reason: 'not_image' });
  });

  it('rejects a file over the byte cap', () => {
    const r = validateUpload({ contentType: 'image/png', byteLength: MAX_UPLOAD_BYTES + 1 });
    expect(r).toEqual({ ok: false, reason: 'too_large' });
  });
});

describe('processPhoto', () => {
  it('writes thumb/card/full WebP derivatives under <uploadsDir>/<tripId>/<photoId>/', async () => {
    const buf = await sampleJpeg();
    const out = await processPhoto({
      buffer: buf,
      uploadsDir,
      tripId: 'trip-1',
      photoId: 'photo-1',
    });

    for (const size of Object.keys(SIZES)) {
      const file = join(uploadsDir, 'trip-1', 'photo-1', `${size}.webp`);
      expect(existsSync(file)).toBe(true);
      const meta = await sharp(file).metadata();
      expect(meta.format).toBe('webp');
    }
    // out reports the dimensions of the largest ('full') derivative.
    expect(out.width).toBe(1600);
    expect(out.height).toBe(800);
  });

  it('caps each derivative long-edge at its target and never enlarges', async () => {
    const buf = await sampleJpeg();
    await processPhoto({ buffer: buf, uploadsDir, tripId: 'trip-1', photoId: 'photo-2' });

    const thumb = await sharp(join(uploadsDir, 'trip-1', 'photo-2', 'thumb.webp')).metadata();
    expect(thumb.width).toBe(320);
    const card = await sharp(join(uploadsDir, 'trip-1', 'photo-2', 'card.webp')).metadata();
    expect(card.width).toBe(800);
  });

  it('strips EXIF (no orientation/exif metadata survives the re-encode)', async () => {
    const withExif = await sharp({
      create: { width: 1200, height: 600, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    await processPhoto({ buffer: withExif, uploadsDir, tripId: 'trip-1', photoId: 'photo-3' });
    const meta = await sharp(join(uploadsDir, 'trip-1', 'photo-3', 'full.webp')).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
  });

  it('rejects a buffer sharp cannot decode (defends against spoofed content type)', async () => {
    await expect(
      processPhoto({ buffer: Buffer.from('not really an image'), uploadsDir, tripId: 'trip-1', photoId: 'bad' }),
    ).rejects.toThrow();
  });
});
