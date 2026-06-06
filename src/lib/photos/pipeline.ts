import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

/** Long-edge caps per derivative (spec §8.5). thumb 320 / card 800 / full 1600. */
export const SIZES = {
  thumb: 320,
  card: 800,
  full: 1600,
} as const;

export type PhotoSize = keyof typeof SIZES;

/** Per-place upload size cap (~10MB), per Plan-2 public-app guards. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export type ValidateResult =
  | { ok: true }
  | { ok: false; reason: 'not_image' | 'too_large' };

/** Guard an upload by declared content type + byte length (no decoding). */
export function validateUpload(input: {
  contentType: string | null | undefined;
  byteLength: number;
}): ValidateResult {
  const ct = input.contentType ?? '';
  if (!ct.startsWith('image/')) return { ok: false, reason: 'not_image' };
  if (input.byteLength > MAX_UPLOAD_BYTES) return { ok: false, reason: 'too_large' };
  return { ok: true };
}

export interface ProcessPhotoInput {
  buffer: Buffer;
  uploadsDir: string;
  tripId: string;
  photoId: string;
}

export interface ProcessPhotoResult {
  /** Path base relative to uploadsDir: '<tripId>/<photoId>'. */
  path: string;
  /** Dimensions of the largest ('full') derivative. */
  width: number;
  height: number;
}

/**
 * Decode `buffer`, then write thumb/card/full WebP derivatives (EXIF-stripped,
 * orientation baked in via `.rotate()`, never enlarged) to
 * `<uploadsDir>/<tripId>/<photoId>/<size>.webp`. Throws if the buffer is not a
 * decodable image (defence against a spoofed content type).
 */
export async function processPhoto(input: ProcessPhotoInput): Promise<ProcessPhotoResult> {
  const { buffer, uploadsDir, tripId, photoId } = input;
  const dir = join(uploadsDir, tripId, photoId);
  await mkdir(dir, { recursive: true });

  // `.rotate()` (no args) bakes EXIF orientation then drops it; re-encoding to
  // WebP without `.withMetadata()` strips all remaining EXIF.
  // `limitInputPixels` is sharp's decompression-bomb guard (268 MP max). We set
  // it explicitly to make the protection visible rather than relying on the default.
  const base = () => sharp(buffer, { limitInputPixels: 268_402_689 }).rotate();

  let full: { width: number; height: number } | null = null;
  for (const size of Object.keys(SIZES) as PhotoSize[]) {
    const cap = SIZES[size];
    const info = await base()
      .resize(cap, cap, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(join(dir, `${size}.webp`));
    if (size === 'full') full = { width: info.width, height: info.height };
  }

  if (!full) throw new Error('processPhoto: missing full derivative');
  return { path: `${tripId}/${photoId}`, width: full.width, height: full.height };
}
