import { describe, it, expect } from 'vitest';
import {
  PHOTO_SIZES,
  isPhotoSize,
  photoBasePath,
  photoDerivativeRelPath,
  type PhotoSize,
} from '@/src/lib/photoPaths';

describe('photoPaths', () => {
  it('PHOTO_SIZES is thumb/card/full', () => {
    expect(PHOTO_SIZES).toEqual(['thumb', 'card', 'full']);
  });

  it('isPhotoSize narrows valid sizes and rejects others', () => {
    expect(isPhotoSize('thumb')).toBe(true);
    expect(isPhotoSize('card')).toBe(true);
    expect(isPhotoSize('full')).toBe(true);
    expect(isPhotoSize('original')).toBe(false);
    expect(isPhotoSize('')).toBe(false);
    expect(isPhotoSize('thumb/../etc')).toBe(false);
  });

  it('photoBasePath is `<tripId>/<photoId>`', () => {
    expect(photoBasePath('trip-1', 'photo-9')).toBe('trip-1/photo-9');
  });

  it('photoDerivativeRelPath appends `/<size>.webp` to the base', () => {
    const base = photoBasePath('trip-1', 'photo-9');
    expect(photoDerivativeRelPath(base, 'thumb')).toBe('trip-1/photo-9/thumb.webp');
    expect(photoDerivativeRelPath(base, 'card')).toBe('trip-1/photo-9/card.webp');
    expect(photoDerivativeRelPath(base, 'full')).toBe('trip-1/photo-9/full.webp');
  });

  it('PhotoSize type accepts the literal union (compile-time)', () => {
    const s: PhotoSize = 'card';
    expect(s).toBe('card');
  });
});
