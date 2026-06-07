import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

/** Long-edge cap for a link OG thumbnail (card-sized derivative). */
export const LINK_THUMB_EDGE = 800;

export interface WriteLinkThumbInput {
  buffer: Buffer;
  uploadsDir: string;
  tripId: string;
  thumbId: string;
}

export interface WriteLinkThumbResult {
  /** Path relative to uploadsDir: '<tripId>/links/<thumbId>.webp'. */
  relPath: string;
}

/**
 * Decode `buffer` and write a single resized WebP (EXIF-stripped, never
 * enlarged) to `<uploadsDir>/<tripId>/links/<thumbId>.webp`. Throws if the
 * buffer is not a decodable image (defence against a spoofed content type).
 * `limitInputPixels` is sharp's decompression-bomb guard (set explicitly).
 */
export async function writeLinkThumb(input: WriteLinkThumbInput): Promise<WriteLinkThumbResult> {
  const { buffer, uploadsDir, tripId, thumbId } = input;
  const dir = join(uploadsDir, tripId, 'links');
  await mkdir(dir, { recursive: true });

  await sharp(buffer, { limitInputPixels: 268_402_689 })
    .rotate()
    .resize(LINK_THUMB_EDGE, LINK_THUMB_EDGE, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(join(dir, `${thumbId}.webp`));

  return { relPath: `${tripId}/links/${thumbId}.webp` };
}
