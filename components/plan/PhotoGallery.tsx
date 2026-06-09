'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { personalPhotoUrl } from '@/src/lib/planUrl';

export type GalleryPhoto = { id: string; width: number | null; height: number | null };

type PhotoGalleryProps = {
  photos: GalleryPhoto[];
  placeName: string;
  /** Offline → delete disabled (mutations are online-only). */
  disabled: boolean;
  onDelete: (photoId: string) => void;
};

export function PhotoGallery({ photos, placeName, disabled, onDelete }: PhotoGalleryProps) {
  const t = useTranslations('plan');
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  if (photos.length === 0) return null;

  const open = viewerIndex != null ? photos[viewerIndex] : null;

  function close() { setViewerIndex(null); }
  function prev() { setViewerIndex((i) => (i == null ? i : (i - 1 + photos.length) % photos.length)); }
  function next() { setViewerIndex((i) => (i == null ? i : (i + 1) % photos.length)); }

  return (
    <div className="mt-3">
      <p className="text-label text-ink">{t('photosLabel')}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {photos.map((p, i) => (
          <li key={p.id} className="relative">
            <button
              type="button"
              onClick={() => setViewerIndex(i)}
              aria-label={t('photoOf', { name: placeName })}
              className="block h-20 w-20 overflow-hidden rounded-[10px] border border-line bg-surface transition active:scale-95"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={personalPhotoUrl(p.id, 'thumb')}
                alt={placeName}
                width={80}
                height={80}
                className="h-20 w-20 object-cover"
              />
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onDelete(p.id)}
              aria-label={t('deletePhoto')}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-chip border border-line bg-bg text-caption font-bold text-danger transition hover:bg-surface active:scale-95 disabled:opacity-40"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('photoOf', { name: placeName })}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-[rgb(0_0_0_/_0.85)] p-4 backdrop-blur-sm"
          onClick={close}
          onKeyDown={(e) => { if (e.key === 'Escape') close(); }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={personalPhotoUrl(open.id, 'full')}
            alt={t('photoOf', { name: placeName })}
            className="max-h-[80vh] max-w-full rounded-card object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="mt-4 flex gap-3" onClick={(e) => e.stopPropagation()}>
            {photos.length > 1 ? (
              <>
                <button type="button" onClick={prev} className="rounded-chip bg-white px-4 py-2 text-label text-ink transition active:scale-95">‹</button>
                <button type="button" onClick={next} className="rounded-chip bg-white px-4 py-2 text-label text-ink transition active:scale-95">›</button>
              </>
            ) : null}
            <button
              type="button"
              onClick={close}
              aria-label={t('closePhoto')}
              className="rounded-chip bg-white px-4 py-2 text-label text-ink transition active:scale-95"
            >
              {t('closePhoto')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
