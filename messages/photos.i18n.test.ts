import { describe, it, expect } from 'vitest';
import en from '@/messages/en.json';

describe('en.json photo strings', () => {
  it('has all photo UI keys under plan', () => {
    for (const key of [
      'photosLabel', 'addPhoto', 'addPhotoOffline', 'uploadingPhoto',
      'photoUploadFailed', 'deletePhoto', 'photoTooLarge', 'photoTooMany',
      'photoNotImage', 'closePhoto', 'photoOf',
    ]) {
      expect(en.plan, `plan.${key}`).toHaveProperty(key);
      expect(typeof (en.plan as Record<string, unknown>)[key]).toBe('string');
    }
  });
});
