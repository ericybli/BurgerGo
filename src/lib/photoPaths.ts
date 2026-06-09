/**
 * Photo path helpers (spec §5.6 / §8.5). A `photos.path` is the **base path**
 * `<tripId>/<photoId>` with no extension. Each base path has three generated
 * WebP derivatives, resolved by appending `/<size>.webp`. These are pure: no
 * filesystem access (the serving route joins them under UPLOADS_DIR with a
 * path-traversal guard, like 1B's Google-photo route).
 */

/** The three derivative sizes, longest-edge targets: thumb 320 / card 800 / full 1600. */
export const PHOTO_SIZES = ['thumb', 'card', 'full'] as const;

export type PhotoSize = (typeof PHOTO_SIZES)[number];

/** Long-edge pixel targets per size (used by the resize pipeline in a later group). */
export const PHOTO_SIZE_MAX_EDGE: Record<PhotoSize, number> = {
  thumb: 320,
  card: 800,
  full: 1600,
};

/** Type guard: is `s` one of the allowed derivative sizes? */
export function isPhotoSize(s: string): s is PhotoSize {
  return (PHOTO_SIZES as readonly string[]).includes(s);
}

/** The DB base path stored in `photos.path`: `<tripId>/<photoId>` (no extension). */
export function photoBasePath(tripId: string, photoId: string): string {
  return `${tripId}/${photoId}`;
}

/** The on-disk relative path of one derivative: `<basePath>/<size>.webp`. */
export function photoDerivativeRelPath(basePath: string, size: PhotoSize): string {
  return `${basePath}/${size}.webp`;
}

/**
 * Cached-Google-photo thumb derivative path. Google photos are stored as a single
 * card-size file `gphotos/<id>.webp` (`photoLocalPath`); the small thumb sibling is
 * `gphotos/<id>-thumb.webp`. Pure string transform — the serving route checks
 * existence and falls back to the card file when the thumb isn't present.
 */
export function googleThumbRelPath(photoLocalPath: string): string {
  return photoLocalPath.replace(/\.webp$/i, '-thumb.webp');
}
