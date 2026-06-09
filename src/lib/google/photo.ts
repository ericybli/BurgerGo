import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { googleThumbRelPath } from '@/src/lib/photoPaths';

/**
 * Download a Google Place photo (server key), re-encode it to a single card-size
 * WebP, and store it under `<uploadsDir>/gphotos/<googlePlaceId>.webp`. Returns
 * the path relative to uploadsDir (for `place_details_cache.photoLocalPath`), or
 * null on any failure — the caller treats null as "no photo". The Place Photo
 * endpoint 302-redirects to the image; fetch follows it.
 */
const PHOTO_URL = 'https://maps.googleapis.com/maps/api/place/photo';
const MAXWIDTH = 800;
const THUMBWIDTH = 320;

export interface StoreGooglePhotoInput {
  photoRef: string;
  googlePlaceId: string;
  apiKey: string;
  uploadsDir: string;
}

export async function fetchAndStoreGooglePhoto(input: StoreGooglePhotoInput): Promise<string | null> {
  const params = new URLSearchParams({
    maxwidth: String(MAXWIDTH),
    photo_reference: input.photoRef,
    key: input.apiKey,
  });
  try {
    const res = await fetch(`${PHOTO_URL}?${params.toString()}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0) return null;

    // Filename from the (already URL-safe) place id; sanitize defensively.
    const safeId = input.googlePlaceId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const rel = `gphotos/${safeId}.webp`;
    await mkdir(join(input.uploadsDir, 'gphotos'), { recursive: true });
    // Decode once, then emit a card-size file (the stored photoLocalPath) plus a
    // small thumb sibling so list/map/gallery thumbnails don't ship the 800px image.
    const pipeline = sharp(buf, { limitInputPixels: 268_402_689 }).rotate();
    await pipeline
      .clone()
      .resize(MAXWIDTH, MAXWIDTH, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(join(input.uploadsDir, rel));
    await pipeline
      .clone()
      .resize(THUMBWIDTH, THUMBWIDTH, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(join(input.uploadsDir, googleThumbRelPath(rel)));
    return rel;
  } catch {
    return null;
  }
}
