import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { googleFullRelPath, googleThumbRelPath } from '@/src/lib/photoPaths';

/**
 * Download a Google Place photo (server key) and re-encode it into the same
 * three-tier WebP set personal photos get (thumb 320 / card 800 / full 1600,
 * long-edge capped, never enlarged). The card file is the base
 * `<uploadsDir>/gphotos/<googlePlaceId>.webp` (what
 * `place_details_cache.photoLocalPath` stores); the full/thumb siblings live
 * next to it as `<id>-full.webp` / `<id>-thumb.webp`. Returns the base path
 * relative to uploadsDir, or null on any failure — the caller treats null as
 * "no photo". The Place Photo endpoint 302-redirects to the image; fetch
 * follows it.
 */
const PHOTO_URL = 'https://maps.googleapis.com/maps/api/place/photo';
const FULLWIDTH = 1600;
const CARDWIDTH = 800;
const THUMBWIDTH = 320;

export interface StoreGooglePhotoInput {
  photoRef: string;
  googlePlaceId: string;
  apiKey: string;
  uploadsDir: string;
}

export async function fetchAndStoreGooglePhoto(input: StoreGooglePhotoInput): Promise<string | null> {
  const params = new URLSearchParams({
    maxwidth: String(FULLWIDTH),
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
    // Decode once, then emit the card-size base file (the stored photoLocalPath)
    // plus full + thumb siblings so phones get a sharp full-width image and
    // list/map/gallery thumbnails don't ship the 800px file.
    const pipeline = sharp(buf, { limitInputPixels: 268_402_689 }).rotate();
    await pipeline
      .clone()
      .resize(CARDWIDTH, CARDWIDTH, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(join(input.uploadsDir, rel));
    await pipeline
      .clone()
      .resize(FULLWIDTH, FULLWIDTH, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(join(input.uploadsDir, googleFullRelPath(rel)));
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
