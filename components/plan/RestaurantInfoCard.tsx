'use client';

import { useTranslations } from 'next-intl';
import { placeUrl } from '@/src/lib/googleMapsUrl';
import { RESTAURANT_GLYPH, type RestaurantMarkerInput } from '@/src/lib/map/markers';

/**
 * Pin-tap info card for a Restaurants-layer marker: name, cuisine, address,
 * notes, and an "Open in Google Maps" deep link (offline-safe). Presentational;
 * the parent positions and dismisses it.
 */
export function RestaurantInfoCard({
  restaurant,
  onClose,
}: {
  restaurant: RestaurantMarkerInput;
  onClose: () => void;
}) {
  const t = useTranslations('planMap');
  const href = placeUrl({
    name: restaurant.name,
    lat: restaurant.lat ?? 0,
    lng: restaurant.lng ?? 0,
    googlePlaceId: restaurant.googlePlaceId,
  });

  return (
    <div
      role="dialog"
      aria-label={restaurant.name}
      className="pointer-events-auto w-full max-w-sm rounded-card bg-card p-3 shadow-lift"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-paper text-xl"
        >
          {RESTAURANT_GLYPH}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-label font-semibold text-ink">{restaurant.name}</h3>
          {restaurant.cuisine ? (
            <p className="truncate text-caption text-ink-muted">{restaurant.cuisine}</p>
          ) : null}
        </div>
        <button
          type="button"
          aria-label={t('closeInfoCard')}
          onClick={onClose}
          className="-mr-1 -mt-1 shrink-0 rounded-chip p-1 text-ink-faint active:bg-line"
        >
          ✕
        </button>
      </div>

      {restaurant.address ? (
        <p className="mt-2 text-caption text-ink">{restaurant.address}</p>
      ) : null}
      {restaurant.notes ? (
        <p className="mt-1 whitespace-pre-wrap text-caption text-ink-muted">{restaurant.notes}</p>
      ) : null}

      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 block w-full rounded-control bg-coral px-3 py-2 text-center text-caption font-medium text-white active:bg-coral-press"
      >
        {t('openInMaps')}
      </a>
    </div>
  );
}
