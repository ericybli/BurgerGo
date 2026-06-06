'use client';

import { useTranslations } from 'next-intl';
import { placeUrl } from '@/src/lib/googleMapsUrl';
import type { PlaceMarker } from '@/src/lib/map/markers';

/**
 * Compact pin-tap info card (spec §3.4): name, localized category, SW-cached
 * thumbnail, and "Open in Google Maps" (plain placeUrl — works offline).
 * Saved-bucket pins also expose "Add to day →" which calls onSelectPlace(id);
 * B2's PlanClient owns the actual promote action. Presentational; PlanMap
 * positions and dismisses it.
 */
export function PlaceInfoCard({
  marker,
  bucket,
  onClose,
  onSelectPlace,
}: {
  marker: PlaceMarker;
  bucket: 'days' | 'saved';
  onClose: () => void;
  onSelectPlace: (placeId: string) => void;
}) {
  const t = useTranslations('planMap');
  const tc = useTranslations('category');

  const href = placeUrl({
    name: marker.name,
    lat: marker.position.lat,
    lng: marker.position.lng,
    googlePlaceId: marker.googlePlaceId,
  });

  return (
    <div
      role="dialog"
      aria-label={t('infoCardLabel')}
      className="pointer-events-auto w-72 rounded-card bg-card p-3 shadow-lift"
    >
      <div className="flex items-start gap-3">
        {marker.photoPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={marker.photoPath}
            alt={marker.name}
            width={56}
            height={56}
            className="h-14 w-14 shrink-0 rounded-control object-cover"
          />
        ) : null}

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-label font-semibold text-ink">{marker.name}</h3>
          <p className="text-caption text-ink-muted">{tc(marker.category)}</p>
        </div>

        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="-mr-1 -mt-1 shrink-0 rounded-chip p-1 text-ink-faint active:bg-line"
        >
          ✕
        </button>
      </div>

      <div className="mt-3 flex gap-2">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 rounded-control bg-coral px-3 py-2 text-center text-caption font-medium text-white active:bg-coral-press"
        >
          {t('openInMaps')}
        </a>

        {bucket === 'saved' ? (
          <button
            type="button"
            onClick={() => onSelectPlace(marker.id)}
            className="rounded-control border border-teal px-3 py-2 text-caption font-medium text-teal active:bg-teal-tint"
          >
            {t('addToDay')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
