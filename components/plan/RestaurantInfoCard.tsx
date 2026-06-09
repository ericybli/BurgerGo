'use client';

import { useTranslations } from 'next-intl';
import { placeUrl } from '@/src/lib/googleMapsUrl';
import type { RestaurantMarkerInput } from '@/src/lib/map/markers';
import { thumbForRestaurant } from '@/src/lib/planUrl';

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
  const thumb = thumbForRestaurant(restaurant);
  const href = placeUrl({
    name: restaurant.name,
    lat: restaurant.lat ?? 0,
    lng: restaurant.lng ?? 0,
    googlePlaceId: restaurant.googlePlaceId,
    address: restaurant.address,
  });

  return (
    <div
      role="dialog"
      aria-label={restaurant.name}
      className="pointer-events-auto w-full max-w-sm rounded-card border border-line bg-bg p-3"
    >
      <div className="flex items-start gap-3">
        {thumb.kind === 'glyph' ? (
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-surface text-xl"
          >
            {thumb.glyph}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14px] font-semibold text-ink">{restaurant.name}</h3>
          {restaurant.cuisine ? (
            <p className="truncate text-caption text-sub">{restaurant.cuisine}</p>
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

      {thumb.kind === 'photo' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb.src} alt={restaurant.name} className="mt-3 h-44 w-full rounded-[10px] object-cover" />
      ) : null}

      {restaurant.address ? (
        <p className="mt-2 text-caption text-ink">{restaurant.address}</p>
      ) : null}
      {restaurant.notes ? (
        <p className="mt-1 whitespace-pre-wrap text-caption text-sub">{restaurant.notes}</p>
      ) : null}

      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 block w-full rounded-control bg-accent px-3 py-2 text-center text-label text-white transition hover:opacity-90 active:opacity-80"
      >
        {t('openInMaps')}
      </a>
    </div>
  );
}
