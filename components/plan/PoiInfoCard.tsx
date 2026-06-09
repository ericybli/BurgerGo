'use client';

import { useTranslations } from 'next-intl';
import { placeUrl } from '@/src/lib/googleMapsUrl';
import type { PoiDetails } from '@/components/plan/googleClient';

export type PoiPreview =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; details: PoiDetails; added: boolean; saving: boolean };

/**
 * Info card for a tapped Google basemap landmark (POI): name + address, an
 * "Add to places" action (saves into the trip's Saved bucket), and an
 * Open-in-Google-Maps link. Presentational; the parent owns state/handlers.
 */
export function PoiInfoCard({
  preview,
  online,
  onAdd,
  onClose,
}: {
  preview: PoiPreview;
  online: boolean;
  onAdd: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('planMap');

  return (
    <div className="pointer-events-auto w-full max-w-sm rounded-card border border-line bg-bg p-3">
      {preview.status === 'loading' ? (
        <p className="px-1 py-2 text-body text-sub">{t('poiLoading')}</p>
      ) : preview.status === 'error' ? (
        <p className="px-1 py-2 text-body text-danger">{t('poiFailed')}</p>
      ) : (
        <>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] font-semibold text-ink">
                {preview.details.name ?? preview.details.address ?? t('poiCardLabel')}
              </h3>
              {preview.details.address ? (
                <p className="mt-0.5 text-caption text-sub">{preview.details.address}</p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label={t('closeInfoCard')}
              onClick={onClose}
              className="-mr-1 -mt-1 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-chip bg-surface text-sub transition hover:bg-line active:scale-95"
            >
              ✕
            </button>
          </div>

          <button
            type="button"
            disabled={!online || preview.added || preview.saving}
            onClick={onAdd}
            className="mt-3 block w-full rounded-control bg-orange px-3 py-2 text-center text-label text-white transition hover:bg-orange-press active:bg-orange-press disabled:bg-surface disabled:text-faint"
          >
            {preview.added ? t('poiAdded') : preview.saving ? t('poiSaving') : t('poiAdd')}
          </button>
          {typeof preview.details.lat === 'number' && typeof preview.details.lng === 'number' ? (
            <a
              href={placeUrl({
                name: preview.details.name ?? '',
                lat: preview.details.lat,
                lng: preview.details.lng,
                googlePlaceId: preview.details.googlePlaceId,
                address: preview.details.address,
              })}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block w-full rounded-control bg-accent px-3 py-2 text-center text-label text-white transition hover:opacity-90 active:opacity-80"
            >
              {t('openInMaps')}
            </a>
          ) : null}
        </>
      )}
    </div>
  );
}
