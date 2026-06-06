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
}

/**
 * Multipart photo upload to POST /api/photos (online-only). Returns the created
 * photo on success, or null on failure (error code surfaced via `error`).
 */
export function usePhotoUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (args: UploadArgs): Promise<UploadedPhoto | null> => {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set('image', args.file);
      fd.set('tripId', args.tripId);
      fd.set('ownerType', 'place');
      fd.set('ownerId', args.ownerId);

      const res = await fetch(withBase('/api/photos'), { method: 'POST', body: fd });
      if (!res.ok) {
        let code = 'upload_failed';
        try {
          const body = (await res.json()) as { error?: string };
          if (body?.error) code = body.error;
        } catch { /* non-JSON error body */ }
        setError(code);
        return null;
      }
      const body = (await res.json()) as { photo: UploadedPhoto };
      return body.photo;
    } catch {
      setError('network');
      return null;
    } finally {
      setUploading(false);
    }
  }, []);

  return { upload, uploading, error };
}
