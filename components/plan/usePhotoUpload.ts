'use client';

import { useCallback, useState } from 'react';
import { withBase } from '@/src/lib/basePath';

export interface UploadedPhoto {
  id: string;
  width: number | null;
  height: number | null;
}

export interface UploadArgs {
  file: File;
  tripId: string;
  ownerId: string;
  /** Photo owner type; defaults to 'place'. Restaurants pass 'restaurant'; Photography 'photo_list'. */
  ownerType?: 'place' | 'journal' | 'restaurant' | 'photo_list' | 'trip';
}

export type UploadResult =
  | { photo: UploadedPhoto; errorCode: null }
  | { photo: null; errorCode: string };

/**
 * Multipart photo upload to POST /api/photos (online-only). Returns the created
 * photo on success, or null on failure (error code surfaced both inline and via
 * the `error` state for convenience).
 */
export function usePhotoUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (args: UploadArgs): Promise<UploadResult> => {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set('image', args.file);
      fd.set('tripId', args.tripId);
      fd.set('ownerType', args.ownerType ?? 'place');
      fd.set('ownerId', args.ownerId);

      const res = await fetch(withBase('/api/photos'), { method: 'POST', body: fd });
      if (!res.ok) {
        let code = 'upload_failed';
        try {
          const body = (await res.json()) as { error?: string };
          if (body?.error) code = body.error;
        } catch { /* non-JSON error body */ }
        setError(code);
        return { photo: null, errorCode: code };
      }
      const body = (await res.json()) as { photo: UploadedPhoto };
      return { photo: body.photo, errorCode: null };
    } catch {
      setError('network');
      return { photo: null, errorCode: 'network' };
    } finally {
      setUploading(false);
    }
  }, []);

  return { upload, uploading, error };
}
